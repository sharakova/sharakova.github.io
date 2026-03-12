#!/usr/bin/env node
/**
 * momon-ga.com 同人誌 人気作品クローラー
 *
 * 全ページをクロールし、いいね数が閾値以上の作品を収集。
 * 画像付き Excel ファイルを出力する。
 */

import { load } from "cheerio";
import ExcelJS from "exceljs";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import path from "path";

// ──────── 設定 ────────
const BASE_URL = "https://momon-ga.com/fanzine/page/";
const FIRST_PAGE_URL = "https://momon-ga.com/fanzine/";
const TOTAL_PAGES = 300;
const LIKE_THRESHOLD = 1; // いいね数が0以外（1以上）を収集
const CONCURRENCY = 10; // 同時リクエスト数
const DELAY_MS = 300; // バッチ間の待機時間 (ms)
const IMG_CONCURRENCY = 20; // 画像ダウンロード同時数
const OUTPUT_DIR = path.resolve("output");
const OUTPUT_FILE = path.join(OUTPUT_DIR, "popular_fanzine.xlsx");

// ──────── ユーティリティ ────────
function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseLikes(text) {
  if (!text) return 0;
  const cleaned = text.replace(/[^0-9]/g, "");
  return parseInt(cleaned, 10) || 0;
}

function pageUrl(pageNum) {
  return pageNum === 1 ? FIRST_PAGE_URL : `${BASE_URL}${pageNum}/`;
}

// ──────── ページ取得 & パース ────────
async function fetchPage(pageNum, retries = 3) {
  const url = pageUrl(pageNum);
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (attempt === retries - 1) {
        console.error(`  ✗ Page ${pageNum} failed: ${e.message}`);
        return null;
      }
      await sleep(1000 * (attempt + 1));
    }
  }
  return null;
}

function parseListPage(html) {
  const $ = load(html);
  const items = [];

  $('a[href*="/fanzine/mo"]').each((_, el) => {
    const $a = $(el);
    const href = $a.attr("href");
    if (!href) return;

    // Sponsored はスキップ
    if ($a.find(".sponsored, .ad-badge").length > 0) return;
    if ($a.text().includes("Sponsored")) return;

    const $img = $a.find("img").first();
    const imgSrc = $img.attr("src") || "";
    const title = $a.find("span").first().text().trim();
    const likeText = $a.find(".post-list-wpulike").text().trim();
    const dateText = $a.find(".post-list-time").text().trim();
    const likes = parseLikes(likeText);

    if (href && title) {
      items.push({ url: href, title, likes, likeText, imgSrc, date: dateText });
    }
  });

  return items;
}

// ──────── メインクロール ────────
async function crawlAll() {
  console.log("═══════════════════════════════════════════════════");
  console.log("  momon-ga.com 同人誌 人気作品クローラー");
  console.log(`  全 ${TOTAL_PAGES} ページ / いいね >= ${LIKE_THRESHOLD} をフィルタ`);
  console.log("═══════════════════════════════════════════════════\n");

  const popular = [];
  let processedPages = 0;
  let totalItemsScanned = 0;
  const startTime = Date.now();

  for (let batchStart = 1; batchStart <= TOTAL_PAGES; batchStart += CONCURRENCY) {
    const batchEnd = Math.min(batchStart + CONCURRENCY - 1, TOTAL_PAGES);
    const pageNums = [];
    for (let p = batchStart; p <= batchEnd; p++) pageNums.push(p);

    const results = await Promise.all(pageNums.map((p) => fetchPage(p)));

    for (const html of results) {
      if (!html) continue;
      const items = parseListPage(html);
      totalItemsScanned += items.length;

      for (const item of items) {
        if (item.likes >= LIKE_THRESHOLD) {
          popular.push(item);
        }
      }
    }

    processedPages += pageNums.length;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const pct = ((processedPages / TOTAL_PAGES) * 100).toFixed(1);
    const eta = (
      ((Date.now() - startTime) / processedPages) *
      (TOTAL_PAGES - processedPages) /
      1000
    ).toFixed(0);

    process.stdout.write(
      `\r  [${pct}%] ${processedPages}/${TOTAL_PAGES} ページ | ` +
        `スキャン: ${totalItemsScanned} | 人気: ${popular.length} | ` +
        `経過: ${elapsed}s | 残り: ~${eta}s   `
    );

    if (batchStart + CONCURRENCY <= TOTAL_PAGES) {
      await sleep(DELAY_MS);
    }
  }

  console.log("\n\n  ✓ クロール完了!\n");
  return popular;
}

// ──────── 画像ダウンロード ────────
async function downloadImage(url, retries = 2) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          Referer: "https://momon-ga.com/",
        },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return Buffer.from(await res.arrayBuffer());
    } catch {
      if (attempt < retries - 1) await sleep(500);
    }
  }
  return null;
}

async function downloadImages(items) {
  console.log(`  画像ダウンロード中... (${items.length} 件)\n`);
  const images = new Map();
  let done = 0;

  for (let i = 0; i < items.length; i += IMG_CONCURRENCY) {
    const batch = items.slice(i, i + IMG_CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (item) => {
        const buf = await downloadImage(item.imgSrc);
        return { url: item.imgSrc, buf };
      })
    );

    for (const { url, buf } of results) {
      if (buf) images.set(url, buf);
    }

    done += batch.length;
    process.stdout.write(
      `\r  画像: ${done}/${items.length} (${((done / items.length) * 100).toFixed(0)}%)   `
    );

    if (i + IMG_CONCURRENCY < items.length) await sleep(200);
  }

  console.log("\n  ✓ 画像ダウンロード完了!\n");
  return images;
}

// ──────── Excel 出力 ────────
async function generateExcel(items, images) {
  console.log("  Excel ファイルを生成中...\n");

  // いいね数の降順でソート
  items.sort((a, b) => b.likes - a.likes);

  const wb = new ExcelJS.Workbook();
  wb.creator = "Manga Crawler";
  wb.created = new Date();

  const ws = wb.addWorksheet("人気同人誌", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  // カラム定義
  ws.columns = [
    { header: "順位", key: "rank", width: 6 },
    { header: "サムネイル", key: "thumbnail", width: 18 },
    { header: "タイトル", key: "title", width: 50 },
    { header: "いいね数", key: "likes", width: 10 },
    { header: "日付", key: "date", width: 16 },
    { header: "URL", key: "url", width: 55 },
  ];

  // ヘッダースタイル
  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEC4899" },
    };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FFD946EF" } },
    };
  });

  // データ行
  const ROW_HEIGHT = 80; // ピクセル (サムネイル用)

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const rowNum = i + 2;
    const row = ws.getRow(rowNum);
    row.height = ROW_HEIGHT;

    row.getCell("rank").value = i + 1;
    row.getCell("rank").alignment = { vertical: "middle", horizontal: "center" };

    row.getCell("title").value = item.title;
    row.getCell("title").alignment = { vertical: "middle", wrapText: true };

    row.getCell("likes").value = item.likes;
    row.getCell("likes").alignment = { vertical: "middle", horizontal: "center" };
    // いいね数でセル色分け
    if (item.likes >= 100) {
      row.getCell("likes").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFFFF3CD" },
      };
      row.getCell("likes").font = { bold: true, color: { argb: "FFB45309" } };
    } else if (item.likes >= 50) {
      row.getCell("likes").fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFEDE9FE" },
      };
      row.getCell("likes").font = { color: { argb: "FF7C3AED" } };
    }

    row.getCell("date").value = item.date;
    row.getCell("date").alignment = { vertical: "middle", horizontal: "center" };

    // URL をハイパーリンクに
    row.getCell("url").value = {
      text: item.url,
      hyperlink: item.url,
    };
    row.getCell("url").font = { color: { argb: "FF3B82F6" }, underline: true };
    row.getCell("url").alignment = { vertical: "middle" };

    // 画像を埋め込み
    const imgBuf = images.get(item.imgSrc);
    if (imgBuf) {
      try {
        const ext = item.imgSrc.endsWith(".webp") ? "png" : "jpeg";
        const imgId = wb.addImage({
          buffer: imgBuf,
          extension: ext,
        });
        ws.addImage(imgId, {
          tl: { col: 1, row: rowNum - 1 },
          ext: { width: 75, height: 100 },
          editAs: "oneCell",
        });
      } catch {
        // 画像追加に失敗した場合はURLを表示
        row.getCell("thumbnail").value = item.imgSrc;
      }
    }

    // 偶数行に背景色
    if (i % 2 === 1) {
      row.eachCell((cell) => {
        if (!cell.fill || cell.fill.pattern === "none") {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFF9FAFB" },
          };
        }
      });
    }
  }

  // 自動フィルター
  ws.autoFilter = {
    from: "A1",
    to: `F${items.length + 1}`,
  };

  // 出力
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  await wb.xlsx.writeFile(OUTPUT_FILE);

  const stats = {
    total: items.length,
    likes100plus: items.filter((i) => i.likes >= 100).length,
    likes50plus: items.filter((i) => i.likes >= 50).length,
    maxLikes: items[0]?.likes || 0,
  };

  console.log(`  ✓ Excel 出力完了: ${OUTPUT_FILE}`);
  console.log(`    総数:       ${stats.total} 作品`);
  console.log(`    100+いいね: ${stats.likes100plus} 作品`);
  console.log(`    50+いいね:  ${stats.likes50plus} 作品`);
  console.log(`    最大いいね: ${stats.maxLikes}`);

  return OUTPUT_FILE;
}

// ──────── 実行 ────────
async function main() {
  const popular = await crawlAll();

  if (popular.length === 0) {
    console.log("  人気作品が見つかりませんでした。");
    process.exit(0);
  }

  console.log(`  → ${popular.length} 件の人気作品を発見\n`);

  // 中間データをJSONで保存（万が一のバックアップ）
  if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(
    path.join(OUTPUT_DIR, "popular_fanzine.json"),
    JSON.stringify(popular, null, 2)
  );
  console.log("  ✓ JSON バックアップ保存完了\n");

  // 画像ダウンロード
  const images = await downloadImages(popular);

  // Excel 生成
  await generateExcel(popular, images);

  console.log("\n═══════════════════════════════════════════════════");
  console.log("  完了!");
  console.log("═══════════════════════════════════════════════════\n");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});

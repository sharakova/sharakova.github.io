#!/usr/bin/env node
/**
 * JSON バックアップから Excel を再生成する
 * いいね閾値を調整して実用的なサイズに
 */

import ExcelJS from "exceljs";
import { readFileSync, existsSync, mkdirSync } from "fs";
import path from "path";

const LIKE_THRESHOLD = 50; // いいね50以上
const IMG_CONCURRENCY = 20;
const OUTPUT_DIR = path.resolve("output");
const JSON_FILE = path.join(OUTPUT_DIR, "popular_fanzine.json");
const OUTPUT_FILE = path.join(OUTPUT_DIR, `popular_fanzine_${LIKE_THRESHOLD}plus.xlsx`);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function downloadImage(url, retries = 2) {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
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

async function main() {
  console.log(`\n  いいね >= ${LIKE_THRESHOLD} で Excel を再生成します\n`);

  const allItems = JSON.parse(readFileSync(JSON_FILE, "utf-8"));
  const items = allItems
    .filter((i) => i.likes >= LIKE_THRESHOLD)
    .sort((a, b) => b.likes - a.likes);

  console.log(`  対象: ${items.length} 件 (全 ${allItems.length} 件中)\n`);

  // 画像ダウンロード
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
    process.stdout.write(`\r  画像: ${done}/${items.length} (${((done / items.length) * 100).toFixed(0)}%)   `);
    if (i + IMG_CONCURRENCY < items.length) await sleep(200);
  }
  console.log("\n  ✓ 画像ダウンロード完了\n");

  // Excel 生成
  console.log("  Excel 生成中...\n");

  const wb = new ExcelJS.Workbook();
  wb.creator = "Manga Crawler";
  wb.created = new Date();

  const ws = wb.addWorksheet("人気同人誌", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  ws.columns = [
    { header: "順位", key: "rank", width: 6 },
    { header: "サムネイル", key: "thumbnail", width: 18 },
    { header: "タイトル", key: "title", width: 50 },
    { header: "いいね数", key: "likes", width: 10 },
    { header: "日付", key: "date", width: 16 },
    { header: "URL", key: "url", width: 55 },
  ];

  const headerRow = ws.getRow(1);
  headerRow.height = 24;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEC4899" } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFD946EF" } } };
  });

  const ROW_HEIGHT = 80;

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
    if (item.likes >= 500) {
      row.getCell("likes").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF3CD" } };
      row.getCell("likes").font = { bold: true, color: { argb: "FFB45309" }, size: 12 };
    } else if (item.likes >= 100) {
      row.getCell("likes").fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEDE9FE" } };
      row.getCell("likes").font = { color: { argb: "FF7C3AED" } };
    }

    row.getCell("date").value = item.date;
    row.getCell("date").alignment = { vertical: "middle", horizontal: "center" };

    row.getCell("url").value = { text: item.url, hyperlink: item.url };
    row.getCell("url").font = { color: { argb: "FF3B82F6" }, underline: true };
    row.getCell("url").alignment = { vertical: "middle" };

    const imgBuf = images.get(item.imgSrc);
    if (imgBuf) {
      try {
        const imgId = wb.addImage({ buffer: imgBuf, extension: "png" });
        ws.addImage(imgId, {
          tl: { col: 1, row: rowNum - 1 },
          ext: { width: 75, height: 100 },
          editAs: "oneCell",
        });
      } catch {
        row.getCell("thumbnail").value = item.imgSrc;
      }
    }

    if (i % 2 === 1) {
      row.eachCell((cell) => {
        if (!cell.fill || cell.fill.pattern === "none") {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF9FAFB" } };
        }
      });
    }
  }

  ws.autoFilter = { from: "A1", to: `F${items.length + 1}` };
  await wb.xlsx.writeFile(OUTPUT_FILE);

  const fileSizeMB = (readFileSync(OUTPUT_FILE).length / 1024 / 1024).toFixed(1);

  console.log(`  ✓ 出力完了: ${OUTPUT_FILE} (${fileSizeMB} MB)`);
  console.log(`    総数:       ${items.length} 作品`);
  console.log(`    500+いいね: ${items.filter((i) => i.likes >= 500).length} 作品`);
  console.log(`    100+いいね: ${items.filter((i) => i.likes >= 100).length} 作品`);
  console.log(`    最大いいね: ${items[0]?.likes || 0}\n`);
}

main().catch((e) => {
  console.error("Error:", e);
  process.exit(1);
});

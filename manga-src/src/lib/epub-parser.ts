import JSZip from "jszip";

export interface EpubPage {
  index: number;
  blob: Blob;
  url: string; // object URL
  width?: number;
  height?: number;
}

export interface EpubMeta {
  title: string;
  author: string;
  direction: "rtl" | "ltr";
  pageCount: number;
}

export interface ParsedEpub {
  meta: EpubMeta;
  pages: EpubPage[];
}

/**
 * EPUB ファイルを解析して画像ページのリストを返す
 */
export async function parseEpub(file: File): Promise<ParsedEpub> {
  const zip = await JSZip.loadAsync(file);

  // container.xml から content.opf のパスを取得
  const containerXml = await zip
    .file("META-INF/container.xml")
    ?.async("text");
  if (!containerXml) throw new Error("Invalid EPUB: no container.xml");

  const opfPathMatch = containerXml.match(/full-path="([^"]+)"/);
  if (!opfPathMatch) throw new Error("Invalid EPUB: cannot find OPF path");
  const opfPath = opfPathMatch[1];
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf("/") + 1);

  // content.opf を解析
  const opfXml = await zip.file(opfPath)?.async("text");
  if (!opfXml) throw new Error("Invalid EPUB: cannot read OPF");

  const parser = new DOMParser();
  const opfDoc = parser.parseFromString(opfXml, "application/xml");

  // メタデータ取得
  const title =
    opfDoc.querySelector("metadata title")?.textContent || file.name;
  const author =
    opfDoc.querySelector("metadata creator")?.textContent || "Unknown";

  // ページ進行方向を取得
  const spine = opfDoc.querySelector("spine");
  const dirAttr = spine?.getAttribute("page-progression-direction");
  const direction: "rtl" | "ltr" = dirAttr === "rtl" ? "rtl" : "ltr";

  // manifest からアイテムマップを作成
  const manifestItems = opfDoc.querySelectorAll("manifest item");
  const itemMap = new Map<string, { href: string; mediaType: string }>();
  manifestItems.forEach((item) => {
    const id = item.getAttribute("id") || "";
    const href = item.getAttribute("href") || "";
    const mediaType = item.getAttribute("media-type") || "";
    itemMap.set(id, { href, mediaType });
  });

  // spine の順序で画像を取得
  const spineItems = opfDoc.querySelectorAll("spine itemref");
  const pages: EpubPage[] = [];
  let pageIndex = 0;

  for (const itemref of Array.from(spineItems)) {
    const idref = itemref.getAttribute("idref");
    if (!idref) continue;

    const item = itemMap.get(idref);
    if (!item) continue;

    // XHTML ページの場合、中の画像を抽出
    if (item.mediaType === "application/xhtml+xml") {
      const xhtmlPath = opfDir + item.href;
      const xhtml = await zip.file(xhtmlPath)?.async("text");
      if (!xhtml) continue;

      const pageDoc = parser.parseFromString(xhtml, "application/xhtml+xml");
      const img = pageDoc.querySelector("img");
      if (img) {
        const imgSrc = img.getAttribute("src") || "";
        // 相対パスを解決
        const imgDir = item.href.substring(
          0,
          item.href.lastIndexOf("/") + 1
        );
        const imgPath = opfDir + imgDir + imgSrc;
        const normalizedPath = normalizePath(imgPath);

        const imgFile = zip.file(normalizedPath);
        if (imgFile) {
          const data = await imgFile.async("blob");
          const ext = normalizedPath.split(".").pop()?.toLowerCase();
          const mimeType =
            ext === "jpg" || ext === "jpeg"
              ? "image/jpeg"
              : ext === "png"
                ? "image/png"
                : ext === "webp"
                  ? "image/webp"
                  : "image/jpeg";
          const blob = new Blob([data], { type: mimeType });
          const url = URL.createObjectURL(blob);

          pages.push({ index: pageIndex, blob, url });
          pageIndex++;
        }
      }
    }
    // 直接画像の場合
    else if (item.mediaType.startsWith("image/")) {
      const imgPath = opfDir + item.href;
      const imgFile = zip.file(imgPath);
      if (imgFile) {
        const data = await imgFile.async("blob");
        const blob = new Blob([data], { type: item.mediaType });
        const url = URL.createObjectURL(blob);
        pages.push({ index: pageIndex, blob, url });
        pageIndex++;
      }
    }
  }

  // spine にページが無い場合 → manifest 内の画像を順に取得
  if (pages.length === 0) {
    const imageEntries: { href: string; mediaType: string }[] = [];
    itemMap.forEach((item) => {
      if (item.mediaType.startsWith("image/")) {
        imageEntries.push(item);
      }
    });
    imageEntries.sort((a, b) => a.href.localeCompare(b.href, undefined, { numeric: true }));

    for (const img of imageEntries) {
      const imgPath = opfDir + img.href;
      const imgFile = zip.file(imgPath);
      if (imgFile) {
        const data = await imgFile.async("blob");
        const blob = new Blob([data], { type: img.mediaType });
        const url = URL.createObjectURL(blob);
        pages.push({ index: pageIndex, blob, url });
        pageIndex++;
      }
    }
  }

  return {
    meta: {
      title,
      author,
      direction,
      pageCount: pages.length,
    },
    pages,
  };
}

/**
 * cleanup: object URL を解放
 */
export function releaseEpub(epub: ParsedEpub) {
  epub.pages.forEach((p) => URL.revokeObjectURL(p.url));
}

/**
 * パスの正規化（../ を解決）
 */
function normalizePath(path: string): string {
  const parts = path.split("/");
  const result: string[] = [];
  for (const part of parts) {
    if (part === "..") {
      result.pop();
    } else if (part !== "." && part !== "") {
      result.push(part);
    }
  }
  return result.join("/");
}

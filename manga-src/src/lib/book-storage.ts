/**
 * IndexedDB を使った EPUB ファイルの永続ストレージ
 *
 * 保存するデータ:
 *   - 元の EPUB ファイル (Blob)
 *   - メタデータ (タイトル, 作者, 方向, ページ数, 追加日時)
 *
 * ページ読込時に EPUB を再パースして ParsedEpub を復元する。
 */

const DB_NAME = "manga-reader";
const DB_VERSION = 1;
const STORE_NAME = "books";

export interface BookRecord {
  /** 一意ID (crypto.randomUUID) */
  id: string;
  /** タイトル */
  title: string;
  /** 作者 */
  author: string;
  /** RTL / LTR */
  direction: "rtl" | "ltr";
  /** ページ数 */
  pageCount: number;
  /** 追加日時 */
  addedAt: number;
  /** 元の EPUB ファイル */
  file: Blob;
}

// ──────── DB 接続 ────────

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ──────── CRUD 操作 ────────

/** 全ブックのメタ情報 (file を除く軽量版) を取得 */
export async function listBooks(): Promise<Omit<BookRecord, "file">[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      const records: BookRecord[] = req.result;
      // file を除いて返す（一覧表示用に軽量化）
      const metas = records
        .map(({ file: _file, ...meta }) => meta)
        .sort((a, b) => b.addedAt - a.addedAt);
      resolve(metas);
    };
    req.onerror = () => reject(req.error);
  });
}

/** 特定のブックレコードを取得 (file 含む) */
export async function getBook(id: string): Promise<BookRecord | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);

    req.onsuccess = () => resolve(req.result ?? undefined);
    req.onerror = () => reject(req.error);
  });
}

/** ブックを保存 */
export async function saveBook(record: BookRecord): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** ブックを削除 */
export async function deleteBook(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(id);

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

/** 全ブックを削除 */
export async function clearAllBooks(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const req = store.clear();

    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

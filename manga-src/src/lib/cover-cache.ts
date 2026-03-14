/**
 * Google Drive 表紙画像の IndexedDB キャッシュ
 * キー: fileId:modifiedTime （ファイル更新時に自動的に再取得される）
 */

const DB_NAME = "manga-reader-covers";
const DB_VERSION = 1;
const STORE_NAME = "covers";

interface CoverRecord {
  key: string; // "fileId:modifiedTime"
  blob: Blob;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function cacheKey(fileId: string, modifiedTime: string): string {
  return `${fileId}:${modifiedTime}`;
}

/** キャッシュから表紙を取得。なければ null */
export async function getCachedCover(
  fileId: string,
  modifiedTime: string
): Promise<Blob | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(cacheKey(fileId, modifiedTime));
      req.onsuccess = () => {
        const record: CoverRecord | undefined = req.result;
        resolve(record?.blob ?? null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/** 表紙をキャッシュに保存 */
export async function saveCachedCover(
  fileId: string,
  modifiedTime: string,
  blob: Blob
): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      store.put({ key: cacheKey(fileId, modifiedTime), blob } as CoverRecord);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
    });
  } catch {
    // キャッシュ保存失敗は無視
  }
}

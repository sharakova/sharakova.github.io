"use client";

/**
 * Google Drive API ユーティリティ
 * - Google Identity Services (GIS) でブラウザ上OAuth認証
 * - Drive API v3 でEPUBファイル一覧・ダウンロード
 * - APIキー不要（OAuthクライアントIDのみ）
 */

const SCOPES = "https://www.googleapis.com/auth/drive.readonly";
const CLIENT_ID =
  "1088323925177-d5bja13t66rpg2ovvpfpak18rifg5r3l.apps.googleusercontent.com";

let gisLoaded = false;

/** Google Identity Services スクリプトを動的にロード */
function loadGisScript(): Promise<void> {
  if (gisLoaded) return Promise.resolve();
  return new Promise((resolve, reject) => {
    if (
      document.querySelector('script[src*="accounts.google.com/gsi/client"]')
    ) {
      gisLoaded = true;
      resolve();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://accounts.google.com/gsi/client";
    s.async = true;
    s.onload = () => {
      gisLoaded = true;
      resolve();
    };
    s.onerror = () =>
      reject(new Error("Google Identity Services の読み込みに失敗しました"));
    document.head.appendChild(s);
  });
}

/** アクセストークンをリクエスト（ポップアップ認証） */
export async function requestAccessToken(): Promise<string> {
  await loadGisScript();

  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response.access_token);
      },
    });
    client.requestAccessToken();
  });
}

/** Drive API のファイル情報 */
export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
  thumbnailLink?: string;
}

/** Drive 上の EPUB ファイル一覧を取得 */
export async function listEpubFiles(
  accessToken: string
): Promise<DriveFile[]> {
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      q: "mimeType='application/epub+zip' and trashed=false",
      fields: "nextPageToken,files(id,name,mimeType,modifiedTime,size,thumbnailLink)",
      orderBy: "modifiedTime desc",
      pageSize: "100",
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) {
      if (res.status === 401)
        throw new Error("認証が切れました。再度ログインしてください。");
      throw new Error(`ファイル一覧の取得に失敗: ${res.status}`);
    }

    const data = await res.json();
    allFiles.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken);

  return allFiles;
}

/** Drive からファイルをダウンロード */
export async function downloadDriveFile(
  fileId: string,
  accessToken: string
): Promise<ArrayBuffer> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    throw new Error(`ダウンロード失敗: ${res.status} ${res.statusText}`);
  }

  return res.arrayBuffer();
}

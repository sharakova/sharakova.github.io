"use client";

import { useState, useRef, useCallback } from "react";
import {
  requestAccessToken,
  listEpubFiles,
  downloadDriveFile,
  type DriveFile,
} from "@/lib/google-drive";
import { extractCover } from "@/lib/epub-parser";
import { getCachedCover, saveCachedCover } from "@/lib/cover-cache";

interface GoogleDriveBrowserProps {
  onFileLoaded: (file: File) => void;
}

export default function GoogleDriveBrowser({
  onFileLoaded,
}: GoogleDriveBrowserProps) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [covers, setCovers] = useState<Record<string, string>>({});
  const coverAbortRef = useRef<AbortController | null>(null);

  /** ファイルリストの表紙をバックグラウンドで順次取得（キャッシュ優先） */
  const loadCovers = useCallback(
    async (fileList: DriveFile[], token: string) => {
      // 前回の処理をキャンセル
      coverAbortRef.current?.abort();
      const abort = new AbortController();
      coverAbortRef.current = abort;

      for (const file of fileList) {
        if (abort.signal.aborted) break;
        try {
          // 1. IndexedDB キャッシュを確認
          const cached = await getCachedCover(file.id, file.modifiedTime);
          if (abort.signal.aborted) break;

          if (cached) {
            const url = URL.createObjectURL(cached);
            setCovers((prev) => ({ ...prev, [file.id]: url }));
            continue;
          }

          // 2. キャッシュなし → Drive からダウンロードして表紙抽出
          const buffer = await downloadDriveFile(file.id, token);
          if (abort.signal.aborted) break;
          const coverUrl = await extractCover(buffer);
          if (abort.signal.aborted) {
            if (coverUrl) URL.revokeObjectURL(coverUrl);
            break;
          }
          if (coverUrl) {
            setCovers((prev) => ({ ...prev, [file.id]: coverUrl }));
            // 3. 表紙を Blob に変換してキャッシュに保存
            try {
              const res = await fetch(coverUrl);
              const blob = await res.blob();
              await saveCachedCover(file.id, file.modifiedTime, blob);
            } catch {
              // キャッシュ保存失敗は無視
            }
          }
        } catch {
          // 個別のエラーは無視して次へ
        }
      }
    },
    []
  );

  /** Google ログイン → ファイル一覧取得 */
  const handleLogin = async () => {
    setIsAuthenticating(true);
    setError(null);
    try {
      const token = await requestAccessToken();
      setAccessToken(token);
      setIsLoadingFiles(true);
      const epubs = await listEpubFiles(token);
      setFiles(epubs);
      setCovers({});
      loadCovers(epubs, token);
    } catch (e) {
      setError(e instanceof Error ? e.message : "認証に失敗しました");
    } finally {
      setIsAuthenticating(false);
      setIsLoadingFiles(false);
    }
  };

  /** ファイル一覧を再取得 */
  const handleRefresh = async () => {
    if (!accessToken) return;
    setIsLoadingFiles(true);
    setError(null);
    try {
      const epubs = await listEpubFiles(accessToken);
      setFiles(epubs);
      setCovers({});
      loadCovers(epubs, accessToken);
    } catch (e) {
      setError(e instanceof Error ? e.message : "取得に失敗しました");
      // 認証切れの場合はリセット
      if (e instanceof Error && e.message.includes("認証が切れました")) {
        setAccessToken(null);
        setFiles([]);
      }
    } finally {
      setIsLoadingFiles(false);
    }
  };

  /** ファイルをダウンロードして読み込む */
  const handleDownload = async (file: DriveFile) => {
    if (!accessToken || downloadingId) return;
    setDownloadingId(file.id);
    setError(null);
    try {
      const buffer = await downloadDriveFile(file.id, accessToken);
      const blob = new Blob([buffer], { type: "application/epub+zip" });
      const f = new File([blob], file.name, { type: "application/epub+zip" });
      onFileLoaded(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ダウンロードに失敗しました");
    } finally {
      setDownloadingId(null);
    }
  };

  /** ファイルサイズを読みやすい形式に */
  const formatSize = (bytes?: string) => {
    if (!bytes) return "";
    const n = Number(bytes);
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  };

  /** 日時フォーマット */
  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("ja-JP", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // 未認証: ログインボタン
  if (!accessToken) {
    return (
      <div className="space-y-3">
        <button
          onClick={handleLogin}
          disabled={isAuthenticating}
          className="
            w-full flex items-center justify-center gap-3
            bg-white/10 hover:bg-white/15 border border-white/20
            rounded-xl px-6 py-4 transition-colors
            disabled:opacity-50 disabled:pointer-events-none
          "
        >
          {isAuthenticating ? (
            <>
              <div className="w-5 h-5 border-2 border-white/50 border-t-transparent rounded-full animate-spin" />
              <span className="text-white/70">認証中...</span>
            </>
          ) : (
            <>
              {/* Google Drive アイコン */}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                <path d="M7.71 3.5L1.15 15l3.43 5.95h6.28L4.29 9.45 7.71 3.5z" fill="#0066DA" />
                <path d="M16.29 3.5H7.71l6.57 11.5h8.57L16.29 3.5z" fill="#00AC47" />
                <path d="M22.85 15H14.28l-3.42 5.95h8.56L22.85 15z" fill="#EA4335" />
                <path d="M14.28 15L7.71 3.5l-3.42 6L10.86 20.95 14.28 15z" fill="#00832D" />
                <path d="M14.28 15h8.57l-3.43-5.95L14.28 15z" fill="#2684FC" />
                <path d="M7.71 3.5l6.57 11.5-3.42 5.95L4.29 9.45 7.71 3.5z" fill="#FFBA00" />
              </svg>
              <span className="text-white font-medium">
                Google Drive から読み込む
              </span>
            </>
          )}
        </button>

        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
      </div>
    );
  }

  // 認証済み: ファイル一覧
  return (
    <div className="space-y-3">
      {/* ヘッダー */}
      <div className="flex items-center justify-between">
        <h3 className="text-white/70 text-sm font-medium flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M7.71 3.5L1.15 15l3.43 5.95h6.28L4.29 9.45 7.71 3.5z" fill="#0066DA" />
            <path d="M16.29 3.5H7.71l6.57 11.5h8.57L16.29 3.5z" fill="#00AC47" />
            <path d="M22.85 15H14.28l-3.42 5.95h8.56L22.85 15z" fill="#EA4335" />
            <path d="M14.28 15L7.71 3.5l-3.42 6L10.86 20.95 14.28 15z" fill="#00832D" />
            <path d="M14.28 15h8.57l-3.43-5.95L14.28 15z" fill="#2684FC" />
            <path d="M7.71 3.5l6.57 11.5-3.42 5.95L4.29 9.45 7.71 3.5z" fill="#FFBA00" />
          </svg>
          Google Drive ({files.length}件)
        </h3>
        <button
          onClick={handleRefresh}
          disabled={isLoadingFiles}
          className="text-white/40 hover:text-white/70 text-xs transition-colors disabled:opacity-50"
        >
          {isLoadingFiles ? "読み込み中..." : "更新"}
        </button>
      </div>

      {error && (
        <p className="text-red-400 text-sm">{error}</p>
      )}

      {/* ファイル一覧 */}
      {isLoadingFiles ? (
        <div className="flex items-center justify-center gap-3 py-8">
          <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-white/50 text-sm">
            ファイル一覧を取得中...
          </span>
        </div>
      ) : files.length === 0 ? (
        <p className="text-white/40 text-sm text-center py-6">
          Google Drive に EPUB ファイルが見つかりませんでした
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {files.map((file) => (
            <button
              key={file.id}
              onClick={() => handleDownload(file)}
              disabled={downloadingId !== null}
              className="
                group relative bg-white/5 rounded-xl overflow-hidden
                border border-white/10 hover:border-pink-500/50
                transition-all duration-300 hover:shadow-lg hover:shadow-pink-500/10
                text-left disabled:opacity-50
              "
            >
              {/* サムネイル */}
              <div className="relative aspect-[3/4] bg-black/50 overflow-hidden">
                {covers[file.id] ? (
                  <img
                    src={covers[file.id]}
                    alt={file.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    draggable={false}
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                    <svg
                      width="40"
                      height="40"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="rgb(236 72 153 / 0.4)"
                      strokeWidth="1.5"
                    >
                      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                    </svg>
                    <div className="w-4 h-4 border-2 border-white/20 border-t-pink-500/50 rounded-full animate-spin" />
                  </div>
                )}

                {/* ダウンロード中オーバーレイ */}
                {downloadingId === file.id && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-pink-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}

                {/* ホバーオーバーレイ */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4 pointer-events-none">
                  <span className="px-6 py-2 bg-pink-500 text-white rounded-full font-medium text-sm">
                    読む
                  </span>
                </div>

                {/* サイズバッジ */}
                {file.size && (
                  <div className="absolute top-2 right-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-black/60 text-white">
                      {formatSize(file.size)}
                    </span>
                  </div>
                )}
              </div>

              {/* ファイル情報 */}
              <div className="p-3">
                <p className="text-white text-sm font-medium truncate" title={file.name}>
                  {file.name.replace(/\.epub$/i, "")}
                </p>
                <p className="text-white/40 text-xs mt-0.5">
                  {formatDate(file.modifiedTime)}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

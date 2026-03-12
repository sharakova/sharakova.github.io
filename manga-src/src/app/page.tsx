"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { parseEpub, releaseEpub, type ParsedEpub } from "@/lib/epub-parser";
import {
  saveBook,
  getBook,
  deleteBook,
  listBooks,
  type BookRecord,
} from "@/lib/book-storage";
import FileUploader from "@/components/FileUploader";
import BookCard from "@/components/BookCard";
import MangaReader from "@/components/MangaReader";

/** ParsedEpub に永続化用の ID を紐付ける */
interface BookEntry {
  id: string;
  epub: ParsedEpub;
}

export default function Home() {
  const [books, setBooks] = useState<BookEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readingBook, setReadingBook] = useState<ParsedEpub | null>(null);
  const [loadProgress, setLoadProgress] = useState("");
  const initRef = useRef(false);

  // ──────── 起動時: IndexedDB から復元 ────────
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    (async () => {
      try {
        const metas = await listBooks();
        if (metas.length === 0) {
          setIsRestoring(false);
          return;
        }

        const entries: BookEntry[] = [];
        for (const meta of metas) {
          try {
            const record = await getBook(meta.id);
            if (!record) continue;
            const file = new File([record.file], `${record.title}.epub`, {
              type: "application/epub+zip",
            });
            const epub = await parseEpub(file);
            if (epub.pages.length > 0) {
              entries.push({ id: record.id, epub });
            }
          } catch (e) {
            console.warn(`Failed to restore book ${meta.id}:`, e);
          }
        }

        setBooks(entries);
      } catch (e) {
        console.error("Failed to load saved books:", e);
      } finally {
        setIsRestoring(false);
      }
    })();
  }, []);

  // ──────── ファイル選択 → パース → DB保存（複数ファイル対応） ────────
  const handleFilesSelect = useCallback(async (files: File[]) => {
    setIsLoading(true);
    setError(null);
    setLoadProgress("");

    const errors: string[] = [];
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (total > 1) {
        setLoadProgress(`${i + 1} / ${total}`);
      }

      try {
        const epub = await parseEpub(file);
        if (epub.pages.length === 0) {
          errors.push(`${file.name}: 画像ページが見つかりませんでした`);
          continue;
        }

        const id = crypto.randomUUID();

        // IndexedDB に保存
        const record: BookRecord = {
          id,
          title: epub.meta.title,
          author: epub.meta.author,
          direction: epub.meta.direction,
          pageCount: epub.meta.pageCount,
          addedAt: Date.now(),
          file: new Blob([file], { type: file.type }),
        };
        await saveBook(record);

        setBooks((prev) => [...prev, { id, epub }]);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "解析に失敗";
        errors.push(`${file.name}: ${msg}`);
      }
    }

    if (errors.length > 0) {
      setError(errors.join("\n"));
    }
    setLoadProgress("");
    setIsLoading(false);
  }, []);

  // ──────── 削除 ────────
  const handleRemoveBook = useCallback(
    async (index: number) => {
      const entry = books[index];
      if (!entry) return;

      releaseEpub(entry.epub);
      await deleteBook(entry.id).catch(console.error);
      setBooks((prev) => prev.filter((_, i) => i !== index));
    },
    [books]
  );

  return (
    <>
      {/* リーダー表示 */}
      {readingBook && (
        <MangaReader
          epub={readingBook}
          onClose={() => setReadingBook(null)}
        />
      )}

      {/* メイン画面 */}
      <main className="min-h-screen">
        {/* ヘッダー */}
        <header className="border-b border-white/10">
          <div className="max-w-5xl mx-auto px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Manga Reader</h1>
                <p className="text-xs text-white/40">EPUB マンガビューア</p>
              </div>
            </div>
          </div>
        </header>

        <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
          {/* ファイルアップロード */}
          <FileUploader
            onFilesSelect={handleFilesSelect}
            isLoading={isLoading}
            progress={loadProgress}
          />

          {/* エラー表示 */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-red-400 text-sm whitespace-pre-line">
              {error}
            </div>
          )}

          {/* 復元中インジケーター */}
          {isRestoring && (
            <div className="flex items-center justify-center gap-3 py-8">
              <div className="w-5 h-5 border-2 border-pink-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-white/50 text-sm">
                保存済みライブラリを読み込んでいます...
              </span>
            </div>
          )}

          {/* 本棚 */}
          {books.length > 0 && (
            <section>
              <h2 className="text-white/70 text-sm font-medium mb-4">
                ライブラリ ({books.length}冊)
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {books.map((entry, i) => (
                  <BookCard
                    key={entry.id}
                    epub={entry.epub}
                    onRead={() => setReadingBook(entry.epub)}
                    onRemove={() => handleRemoveBook(i)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* 使い方ガイド */}
          {books.length === 0 && !isLoading && !isRestoring && (
            <section className="mt-12 text-center space-y-6">
              <h2 className="text-white/50 text-lg font-medium">
                使い方
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl mx-auto">
                <div className="bg-white/5 rounded-xl p-4 space-y-2">
                  <div className="text-2xl">📁</div>
                  <h3 className="text-white/80 text-sm font-medium">
                    1. ファイルを選択
                  </h3>
                  <p className="text-white/40 text-xs">
                    EPUBファイルをドロップまたは選択
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 space-y-2">
                  <div className="text-2xl">📖</div>
                  <h3 className="text-white/80 text-sm font-medium">
                    2. 読む
                  </h3>
                  <p className="text-white/40 text-xs">
                    マンガアプリのようなUIで閲覧
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 space-y-2">
                  <div className="text-2xl">💾</div>
                  <h3 className="text-white/80 text-sm font-medium">
                    3. 自動保存
                  </h3>
                  <p className="text-white/40 text-xs">
                    ブラウザに保存され次回も閲覧可能
                  </p>
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-6 max-w-md mx-auto text-left space-y-3">
                <h3 className="text-white/70 text-sm font-medium">
                  キーボードショートカット
                </h3>
                <div className="space-y-1.5 text-xs">
                  {[
                    ["← →", "ページ移動"],
                    ["↑ ↓ / Space", "ページ移動"],
                    ["F", "フルスクリーン"],
                    ["Esc", "リーダーを閉じる"],
                  ].map(([key, desc]) => (
                    <div key={key} className="flex items-center gap-3">
                      <kbd className="px-2 py-0.5 rounded bg-white/10 text-white/60 font-mono min-w-[60px] text-center">
                        {key}
                      </kbd>
                      <span className="text-white/40">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}

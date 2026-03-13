"use client";

import type { ParsedEpub } from "@/lib/epub-parser";

interface BookCardProps {
  epub: ParsedEpub;
  onRead: () => void;
  onRemove: () => void;
}

export default function BookCard({ epub, onRead, onRemove }: BookCardProps) {
  const { meta, pages } = epub;
  const coverUrl = pages[0]?.url;

  return (
    <div
      className="group relative bg-white/5 rounded-xl overflow-hidden border border-white/10 hover:border-pink-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-pink-500/10 cursor-pointer"
      onClick={onRead}
    >
      {/* カバー画像 */}
      <div className="relative aspect-[3/4] bg-black/50 overflow-hidden">
        {coverUrl && (
          <img
            src={coverUrl}
            alt={meta.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            draggable={false}
          />
        )}
        {/* オーバーレイ（PC: hover時に表示） */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4 pointer-events-none">
          <span className="px-6 py-2 bg-pink-500 text-white rounded-full font-medium text-sm">
            読む
          </span>
        </div>
        {/* バッジ */}
        <div className="absolute top-2 right-2 flex gap-1.5">
          <span
            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              meta.direction === "rtl"
                ? "bg-orange-500/80 text-white"
                : "bg-green-500/80 text-white"
            }`}
          >
            {meta.direction === "rtl" ? "RTL" : "LTR"}
          </span>
          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-black/60 text-white">
            {meta.pageCount}P
          </span>
        </div>
      </div>

      {/* 情報 */}
      <div className="p-3">
        <h3 className="text-white text-sm font-medium truncate" title={meta.title}>
          {meta.title}
        </h3>
        <p className="text-white/40 text-xs mt-0.5 truncate">{meta.author}</p>
      </div>

      {/* 削除ボタン */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="absolute top-2 left-2 p-1.5 rounded-lg bg-black/60 text-white/50 hover:text-red-400 hover:bg-black/80 opacity-0 group-hover:opacity-100 active:opacity-100 transition-all"
        title="削除"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

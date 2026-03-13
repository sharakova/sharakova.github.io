"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type TouchEvent as ReactTouchEvent,
} from "react";
import type { ParsedEpub } from "@/lib/epub-parser";

type ReadingMode = "horizontal" | "vertical";

interface MangaReaderProps {
  epub: ParsedEpub;
  onClose: () => void;
}

export default function MangaReader({ epub, onClose }: MangaReaderProps) {
  const { meta, pages } = epub;
  const [currentPage, setCurrentPage] = useState(0);
  const [mode, setMode] = useState<ReadingMode>("horizontal");
  const [showUI, setShowUI] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPageList, setShowPageList] = useState(false);

  // スワイプ用
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [swipeOffset, setSwipeOffset] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const verticalContainerRef = useRef<HTMLDivElement>(null);

  // タッチ後の合成clickを無視するためのフラグ
  const touchHandledRef = useRef(false);

  const isRTL = meta.direction === "rtl";
  const totalPages = pages.length;

  // UI自動非表示
  const hideTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const resetHideTimer = useCallback(() => {
    setShowUI(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowUI(false), 3000);
  }, []);

  // ページ遷移
  const goToPage = useCallback(
    (page: number) => {
      const clamped = Math.max(0, Math.min(page, totalPages - 1));
      setCurrentPage(clamped);
      setSwipeOffset(0);
    },
    [totalPages]
  );

  const goNext = useCallback(() => {
    goToPage(currentPage + 1);
  }, [currentPage, goToPage]);

  const goPrev = useCallback(() => {
    goToPage(currentPage - 1);
  }, [currentPage, goToPage]);

  // キーボード操作
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (mode === "horizontal") {
        if (e.key === "ArrowRight") {
          isRTL ? goPrev() : goNext();
        } else if (e.key === "ArrowLeft") {
          isRTL ? goNext() : goPrev();
        }
      }
      if (e.key === "ArrowDown" || e.key === " ") {
        if (mode === "horizontal") goNext();
      }
      if (e.key === "ArrowUp") {
        if (mode === "horizontal") goPrev();
      }
      if (e.key === "Escape") {
        if (isFullscreen) {
          document.exitFullscreen?.();
        } else {
          onClose();
        }
      }
      if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      }
      resetHideTimer();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [mode, isRTL, goNext, goPrev, isFullscreen, onClose, resetHideTimer]);

  // フルスクリーン
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // タッチ操作（水平モード）
  const onTouchStart = (e: ReactTouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    touchDeltaRef.current = { x: 0, y: 0 };
  };

  const onTouchMove = (e: ReactTouchEvent) => {
    if (!touchStartRef.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;
    touchDeltaRef.current = { x: dx, y: dy };

    if (mode === "horizontal" && Math.abs(dx) > Math.abs(dy)) {
      setSwipeOffset(dx);
    }
  };

  const onTouchEnd = () => {
    const { x: dx, y: dy } = touchDeltaRef.current;
    const threshold = 50;

    // タッチ操作を処理済みとしてマーク（合成clickを無視するため）
    touchHandledRef.current = true;
    setTimeout(() => { touchHandledRef.current = false; }, 300);

    if (mode === "horizontal" && Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy)) {
      if (isRTL) {
        dx < 0 ? goNext() : goPrev();
      } else {
        dx > 0 ? goPrev() : goNext();
      }
    } else if (mode === "horizontal" && Math.abs(dx) <= 10 && Math.abs(dy) <= 10) {
      // タップ: 画面の左右1/3でページ遷移、中央でUI表示切替
      if (touchStartRef.current) {
        const screenW = window.innerWidth;
        const tapX = touchStartRef.current.x;
        if (tapX < screenW / 3) {
          isRTL ? goNext() : goPrev();
        } else if (tapX > (screenW * 2) / 3) {
          isRTL ? goPrev() : goNext();
        } else {
          setShowUI((v) => !v);
        }
      }
    }

    touchStartRef.current = null;
    setSwipeOffset(0);
  };

  // 画面タップ（水平モード・マウスのみ）
  const onClickArea = (e: React.MouseEvent) => {
    // タッチ操作後の合成clickイベントは無視する
    if (touchHandledRef.current) return;
    if (mode !== "horizontal") return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;

    if (relX < 0.3) {
      isRTL ? goNext() : goPrev();
    } else if (relX > 0.7) {
      isRTL ? goPrev() : goNext();
    } else {
      setShowUI((v) => !v);
    }
    resetHideTimer();
  };

  // 垂直モードでのスクロール位置からページ番号を更新
  useEffect(() => {
    if (mode !== "vertical" || !verticalContainerRef.current) return;
    const container = verticalContainerRef.current;
    const handler = () => {
      const scrollTop = container.scrollTop;
      const pageHeight = container.clientHeight;
      const page = Math.round(scrollTop / pageHeight);
      setCurrentPage(Math.max(0, Math.min(page, totalPages - 1)));
    };
    container.addEventListener("scroll", handler, { passive: true });
    return () => container.removeEventListener("scroll", handler);
  }, [mode, totalPages]);

  // 垂直モードに切替時、現在のページにスクロール
  useEffect(() => {
    if (mode === "vertical" && verticalContainerRef.current) {
      const pageHeight = verticalContainerRef.current.clientHeight;
      verticalContainerRef.current.scrollTo({
        top: currentPage * pageHeight,
        behavior: "instant",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 bg-black z-50 select-none overflow-hidden"
    >
      {/* ===== ヘッダー ===== */}
      <header
        className={`absolute top-0 left-0 right-0 z-30 transition-transform duration-300 ${showUI ? "translate-y-0" : "-translate-y-full"}`}
      >
        <div className="bg-gradient-to-b from-black/80 to-transparent px-4 pt-3 pb-8">
          <div className="flex items-center justify-between max-w-3xl mx-auto">
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white p-2 -ml-2"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
            </button>
            <h1 className="text-white text-sm font-medium truncate mx-4 flex-1 text-center">
              {meta.title}
            </h1>
            <button
              onClick={toggleFullscreen}
              className="text-white/80 hover:text-white p-2"
              title="フルスクリーン"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                {isFullscreen ? (
                  <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
                ) : (
                  <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                )}
              </svg>
            </button>
          </div>
        </div>
      </header>

      {/* ===== メインコンテンツ（水平モード） ===== */}
      {mode === "horizontal" && (
        <div
          className="w-full h-full flex items-center justify-center cursor-pointer"
          onClick={onClickArea}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* 前ページプリロード */}
          {currentPage > 0 && (
            <img
              src={pages[currentPage - 1].url}
              alt=""
              className="hidden"
              loading="eager"
            />
          )}
          {/* 次ページプリロード */}
          {currentPage < totalPages - 1 && (
            <img
              src={pages[currentPage + 1].url}
              alt=""
              className="hidden"
              loading="eager"
            />
          )}

          <img
            src={pages[currentPage]?.url}
            alt={`Page ${currentPage + 1}`}
            className="max-w-full max-h-full object-contain transition-transform duration-100"
            style={{
              transform: `translateX(${swipeOffset}px)`,
            }}
            draggable={false}
          />

          {/* タップ領域ガイド（UI表示時のみ） */}
          {showUI && (
            <>
              <div className="absolute left-0 top-0 bottom-0 w-1/3 flex items-center justify-start pl-4 pointer-events-none">
                <span className="text-white/20 text-4xl">{isRTL ? "›" : "‹"}</span>
              </div>
              <div className="absolute right-0 top-0 bottom-0 w-1/3 flex items-center justify-end pr-4 pointer-events-none">
                <span className="text-white/20 text-4xl">{isRTL ? "‹" : "›"}</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===== メインコンテンツ（垂直モード） ===== */}
      {mode === "vertical" && (
        <div
          ref={verticalContainerRef}
          className="w-full h-full overflow-y-auto scroll-smooth snap-y snap-mandatory"
          onClick={() => setShowUI((v) => !v)}
        >
          {pages.map((page, i) => (
            <div
              key={i}
              className="w-full h-full flex items-center justify-center snap-start shrink-0"
            >
              <img
                src={page.url}
                alt={`Page ${i + 1}`}
                className="max-w-full max-h-full object-contain"
                loading={Math.abs(i - currentPage) < 3 ? "eager" : "lazy"}
                draggable={false}
              />
            </div>
          ))}
        </div>
      )}

      {/* ===== フッター ===== */}
      <footer
        className={`absolute bottom-0 left-0 right-0 z-30 transition-transform duration-300 ${showUI ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-8">
          <div className="max-w-3xl mx-auto space-y-3">
            {/* スライダー */}
            <div className="flex items-center gap-3">
              <span className="text-white/60 text-xs w-10 text-right">
                {currentPage + 1}
              </span>
              <input
                type="range"
                min={0}
                max={totalPages - 1}
                value={currentPage}
                onChange={(e) => goToPage(Number(e.target.value))}
                className="flex-1 h-1 accent-pink-500"
                style={{ direction: isRTL ? "rtl" : "ltr" }}
              />
              <span className="text-white/60 text-xs w-10">
                {totalPages}
              </span>
            </div>

            {/* コントロール */}
            <div className="flex items-center justify-center gap-2">
              {/* モード切替 */}
              <button
                onClick={() =>
                  setMode(mode === "horizontal" ? "vertical" : "horizontal")
                }
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  mode === "horizontal"
                    ? "bg-pink-500/20 text-pink-400"
                    : "bg-blue-500/20 text-blue-400"
                }`}
              >
                {mode === "horizontal" ? (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    左右スライド
                  </>
                ) : (
                  <>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
                    上下スクロール
                  </>
                )}
              </button>

              {/* 方向表示 */}
              <span
                className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                  isRTL
                    ? "bg-orange-500/20 text-orange-400"
                    : "bg-green-500/20 text-green-400"
                }`}
              >
                {isRTL ? "← 右→左" : "→ 左→右"}
              </span>

              {/* ページ一覧 */}
              <button
                onClick={() => setShowPageList((v) => !v)}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-white/10 text-white/70 hover:text-white"
              >
                一覧
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* ===== ページ一覧オーバーレイ ===== */}
      {showPageList && (
        <div className="absolute inset-0 z-40 bg-black/95 overflow-y-auto p-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-white font-bold">
                ページ一覧 ({totalPages}ページ)
              </h2>
              <button
                onClick={() => setShowPageList(false)}
                className="text-white/60 hover:text-white p-2"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
              {pages.map((page, i) => (
                <button
                  key={i}
                  onClick={() => {
                    goToPage(i);
                    setShowPageList(false);
                    setShowUI(true);
                  }}
                  className={`relative aspect-[3/4] rounded overflow-hidden border-2 transition-colors ${
                    i === currentPage
                      ? "border-pink-500"
                      : "border-transparent hover:border-white/30"
                  }`}
                >
                  <img
                    src={page.url}
                    alt={`Page ${i + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <span className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] text-center py-0.5">
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

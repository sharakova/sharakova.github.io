"use client";

import { useState, useRef, type DragEvent } from "react";

interface FileUploaderProps {
  onFileSelect: (file: File) => void;
  isLoading: boolean;
}

export default function FileUploader({
  onFileSelect,
  isLoading,
}: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragIn = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragOut = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer?.files;
    if (files?.[0] && files[0].name.toLowerCase().endsWith(".epub")) {
      onFileSelect(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onFileSelect(file);
    }
  };

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-2xl p-12 text-center
        transition-all duration-300 cursor-pointer
        ${
          isDragging
            ? "border-pink-400 bg-pink-500/10 scale-[1.02]"
            : "border-white/20 hover:border-white/40 bg-white/5"
        }
        ${isLoading ? "pointer-events-none opacity-60" : ""}
      `}
      onClick={() => inputRef.current?.click()}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".epub"
        className="hidden"
        onChange={handleFileChange}
        disabled={isLoading}
      />

      {isLoading ? (
        <div className="space-y-4">
          <div className="w-12 h-12 mx-auto border-4 border-pink-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-white/70">EPUBファイルを解析中...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Book icon */}
          <div className="w-16 h-16 mx-auto rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
          </div>

          <div>
            <p className="text-white font-semibold text-lg">
              EPUBファイルをドロップ
            </p>
            <p className="text-white/50 text-sm mt-1">
              またはクリックしてファイルを選択
            </p>
          </div>

          <div className="inline-flex items-center gap-2 text-xs text-white/30">
            <span className="px-2 py-0.5 rounded bg-white/10">.epub</span>
            対応
          </div>
        </div>
      )}
    </div>
  );
}

import { useRef, useState } from "react";

interface StepUploadProps {
  file: File | null;
  onFile: (file: File) => void;
}

export default function StepUpload({ file, onFile }: StepUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = (f: File | undefined) => {
    if (!f) return;
    if (!/\.(docx|epub)$/i.test(f.name)) {
      setError(
        "Word の .docx ファイル、または .epub ファイルを選んでください。",
      );
      return;
    }
    setError(null);
    onFile(f);
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-stone-900">
        1. 原稿または EPUB をアップロード
      </h2>
      <p className="mt-1 text-sm text-stone-500">
        Word の <code className="rounded bg-stone-100 px-1">.docx</code>{" "}
        を取り込んで新しく本を作るか、すでにある{" "}
        <code className="rounded bg-stone-100 px-1">.epub</code>{" "}
        を読み込んで編集できます。 ファイルはブラウザ内だけで処理されます。
      </p>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={[
          "mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition",
          dragging
            ? "border-stone-900 bg-stone-50"
            : "border-stone-300 hover:border-stone-400 hover:bg-stone-50",
        ].join(" ")}
      >
        <div className="text-4xl">📄</div>
        <p className="mt-3 font-medium text-stone-700">
          ここに .docx または .epub をドラッグ&ドロップ
        </p>
        <p className="mt-1 text-sm text-stone-400">またはクリックして選択</p>
        <input
          ref={inputRef}
          type="file"
          accept=".docx,.epub,application/epub+zip"
          className="hidden"
          onChange={(e) => accept(e.target.files?.[0])}
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      {file && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="text-xl">
            {/\.epub$/i.test(file.name) ? "📘" : "✅"}
          </span>
          <div className="min-w-0">
            <p className="truncate font-medium text-stone-800">{file.name}</p>
            <p className="text-xs text-stone-500">
              {(file.size / 1024).toLocaleString(undefined, {
                maximumFractionDigits: 0,
              })}{" "}
              KB ・{" "}
              {/\.epub$/i.test(file.name)
                ? "EPUB 編集モード"
                : "Word 取り込み"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

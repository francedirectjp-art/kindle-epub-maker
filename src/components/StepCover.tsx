import { useRef, useState } from "react";
import type { CoverImage } from "../lib/types";

interface StepCoverProps {
  cover: CoverImage | null;
  previewUrl: string | null;
  onCover: (cover: CoverImage | null, previewUrl: string | null) => void;
}

export default function StepCover({
  cover,
  previewUrl,
  onCover,
}: StepCoverProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  const accept = async (f: File | undefined) => {
    if (!f) return;
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) {
      setError("JPEG / PNG / WebP の画像を選んでください。");
      return;
    }
    setError(null);
    const data = await f.arrayBuffer();
    const ext = f.type === "image/png" ? "png" : f.type === "image/webp" ? "webp" : "jpg";
    onCover(
      { filename: `cover.${ext}`, mediaType: f.type, data },
      URL.createObjectURL(f),
    );
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-stone-900">3. 表紙画像（任意）</h2>
      <p className="mt-1 text-sm text-stone-500">
        KDP 推奨は縦長（1.6:1 / 例 1600×2560px）。スキップも可能です。
      </p>

      <div className="mt-5 flex flex-col items-start gap-5 sm:flex-row">
        <div
          onClick={() => inputRef.current?.click()}
          className="flex h-64 w-44 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 hover:border-stone-400"
        >
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="表紙プレビュー"
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="px-3 text-center text-sm text-stone-400">
              クリックして
              <br />
              画像を選択
            </span>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => accept(e.target.files?.[0])}
          />
        </div>

        <div className="text-sm text-stone-600">
          {cover ? (
            <>
              <p className="font-medium text-stone-800">{cover.filename}</p>
              <p className="text-xs text-stone-500">{cover.mediaType}</p>
              <button
                type="button"
                onClick={() => onCover(null, null)}
                className="mt-3 rounded-lg border border-stone-300 px-3 py-1.5 text-xs hover:bg-stone-100"
              >
                表紙を削除
              </button>
            </>
          ) : (
            <p className="text-stone-400">表紙はあとから KDP 側でも設定できます。</p>
          )}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  );
}

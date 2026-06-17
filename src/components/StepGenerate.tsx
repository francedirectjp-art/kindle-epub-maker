import { useState } from "react";
import { saveAs } from "file-saver";
import { parseDocx } from "../lib/docx";
import { buildEpub, safeFilename } from "../lib/epub";
import type {
  BookMetadata,
  ConversionOptions,
  CoverImage,
} from "../lib/types";

interface StepGenerateProps {
  arrayBuffer: ArrayBuffer | null;
  metadata: BookMetadata;
  options: ConversionOptions;
  cover: CoverImage | null;
}

interface Result {
  blob: Blob;
  filename: string;
  chapters: number;
  images: number;
  messages: string[];
}

export default function StepGenerate({
  arrayBuffer,
  metadata,
  options,
  cover,
}: StepGenerateProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const generate = async () => {
    if (!arrayBuffer) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      // ArrayBuffer は内部で detach されうるのでコピーを渡す
      const parsed = await parseDocx(arrayBuffer.slice(0), options);
      const modified = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
      const blob = await buildEpub({
        metadata,
        options,
        chapters: parsed.chapters,
        images: parsed.images,
        cover,
        modified,
      });
      setResult({
        blob,
        filename: safeFilename(metadata.title),
        chapters: parsed.chapters.length,
        images: parsed.images.length,
        messages: parsed.messages.slice(0, 5),
      });
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "変換中に予期しないエラーが発生しました。",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-stone-900">6. EPUB を生成</h2>
      <p className="mt-1 text-sm text-stone-500">
        設定内容で EPUB3 を生成します。完成したファイルは Amazon KDP に
        そのままアップロードできます。
      </p>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-xl bg-stone-100 px-4 py-3">
          <dt className="text-stone-500">タイトル</dt>
          <dd className="truncate font-medium text-stone-800">
            {metadata.title || "（未設定）"}
          </dd>
        </div>
        <div className="rounded-xl bg-stone-100 px-4 py-3">
          <dt className="text-stone-500">著者</dt>
          <dd className="truncate font-medium text-stone-800">
            {metadata.author || "（未設定）"}
          </dd>
        </div>
        <div className="rounded-xl bg-stone-100 px-4 py-3">
          <dt className="text-stone-500">組み方向</dt>
          <dd className="font-medium text-stone-800">
            {options.writingMode === "vertical" ? "縦書き" : "横書き"}
          </dd>
        </div>
      </dl>

      <button
        type="button"
        disabled={busy || !arrayBuffer}
        onClick={generate}
        className="mt-6 w-full rounded-xl bg-stone-900 py-3 font-semibold text-white transition hover:bg-stone-800 disabled:opacity-50"
      >
        {busy ? "変換中…" : "EPUB に変換する"}
      </button>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center gap-2 text-emerald-800">
            <span className="text-2xl">🎉</span>
            <span className="font-bold">EPUB の生成が完了しました</span>
          </div>
          <p className="mt-2 text-sm text-emerald-700">
            {result.chapters} 章 / 画像 {result.images} 点 ・{" "}
            {(result.blob.size / 1024).toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}{" "}
            KB
          </p>
          <button
            type="button"
            onClick={() => saveAs(result.blob, result.filename)}
            className="mt-4 w-full rounded-xl bg-emerald-600 py-3 font-semibold text-white transition hover:bg-emerald-700"
          >
            ⬇ {result.filename} をダウンロード
          </button>
          {result.messages.length > 0 && (
            <details className="mt-4 text-xs text-stone-600">
              <summary className="cursor-pointer">変換時の注意 ({result.messages.length})</summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {result.messages.map((m, i) => (
                  <li key={i}>{m}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

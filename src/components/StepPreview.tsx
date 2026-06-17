import { useEffect, useMemo, useRef, useState } from "react";
import { applyVerticalCharSpacing, parseDocx } from "../lib/docx";
import { styleCss } from "../lib/epub";
import {
  VERTICAL_LETTER_SPACING_VALUES,
  type BookMetadata,
  type Chapter,
  type ConversionOptions,
  type ExtractedImage,
} from "../lib/types";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface StepPreviewProps {
  arrayBuffer: ArrayBuffer | null;
  metadata: BookMetadata;
  options: ConversionOptions;
}

interface PreviewData {
  chapters: Chapter[];
  imageUrls: Record<string, string>;
}

function rewriteImageSrc(html: string, urls: Record<string, string>): string {
  return html.replace(
    /src="\.\.\/images\/([^"]+)"/g,
    (m, filename: string) => (urls[filename] ? `src="${urls[filename]}"` : m),
  );
}

function buildImageUrls(images: ExtractedImage[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const img of images) {
    // Uint8Array を Blob に渡す際、TS が共有バッファ可能性で渋るので
    // 専用 ArrayBuffer にコピーして安全に変換する。
    const buf = new ArrayBuffer(img.data.byteLength);
    new Uint8Array(buf).set(img.data);
    const blob = new Blob([buf], { type: img.mediaType });
    map[img.filename] = URL.createObjectURL(blob);
  }
  return map;
}

export default function StepPreview({
  arrayBuffer,
  metadata,
  options,
}: StepPreviewProps) {
  const [data, setData] = useState<PreviewData | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const lastUrls = useRef<string[]>([]);

  useEffect(() => {
    if (!arrayBuffer) return;
    let cancelled = false;
    setBusy(true);
    setError(null);

    (async () => {
      try {
        const parsed = await parseDocx(arrayBuffer.slice(0), options);
        if (cancelled) return;
        lastUrls.current.forEach((u) => URL.revokeObjectURL(u));
        const imageUrls = buildImageUrls(parsed.images);
        lastUrls.current = Object.values(imageUrls);
        setData({ chapters: parsed.chapters, imageUrls });
        setActiveIndex((i) => Math.min(i, parsed.chapters.length - 1));
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setError(
          e instanceof Error
            ? e.message
            : "プレビュー生成中にエラーが発生しました。",
        );
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [arrayBuffer, options]);

  useEffect(() => {
    return () => {
      lastUrls.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  const css = useMemo(() => styleCss(options), [options]);
  const vertical = options.writingMode === "vertical";

  const currentChapter = data?.chapters[activeIndex];
  const renderedHtml = useMemo(() => {
    if (!currentChapter || !data) return "";
    const withImages = rewriteImageSrc(currentChapter.html, data.imageUrls);
    if (options.writingMode !== "vertical") return withImages;
    const spacing = VERTICAL_LETTER_SPACING_VALUES[options.lineHeight];
    return applyVerticalCharSpacing(withImages, spacing);
  }, [currentChapter, data, options.writingMode, options.lineHeight]);

  const iframeSrcDoc = useMemo(() => {
    if (!currentChapter) return "";
    return `<!doctype html>
<html lang="${escapeHtml(metadata.language || "ja")}">
<head>
<meta charset="utf-8"/>
<style>
${css}
html, body { background: #faf9f6; }
${vertical ? "html, body { height: 100%; }" : ""}
</style>
</head>
<body>
${renderedHtml}
</body>
</html>`;
  }, [currentChapter, renderedHtml, css, vertical, metadata.language]);

  return (
    <div>
      <h2 className="text-xl font-bold text-stone-900">5. プレビュー</h2>
      <p className="mt-1 text-sm text-stone-500">
        いまの設定で EPUB がどう表示されるか確認できます（読むだけ・編集はできません）。
        オプションを変更すると、ここの表示もすぐに切り替わります。
      </p>

      {!arrayBuffer && (
        <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">
          原稿（.docx）をアップロードしてください。
        </div>
      )}

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {data && data.chapters.length > 0 && (
        <>
          {data.chapters.length > 1 && (
            <div className="mt-5 flex flex-wrap gap-2">
              {data.chapters.map((ch, i) => (
                <button
                  key={ch.id}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={[
                    "rounded-lg border px-3 py-1.5 text-xs transition",
                    activeIndex === i
                      ? "border-stone-900 bg-stone-900 text-white"
                      : "border-stone-300 text-stone-700 hover:bg-stone-100",
                  ].join(" ")}
                >
                  {ch.title || `第${i + 1}章`}
                </button>
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 text-xs text-stone-500">
            <span className="rounded-full bg-stone-100 px-2 py-1">
              全 {data.chapters.length} 章
            </span>
            <span className="rounded-full bg-stone-100 px-2 py-1">
              {options.writingMode === "vertical" ? "縦書き" : "横書き"}
            </span>
            {busy && (
              <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-700">
                更新中…
              </span>
            )}
          </div>

          <div className="mt-3 overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-inner">
            <div className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-xs text-stone-500">
              📖 {metadata.title || "（タイトル未設定）"} ・{" "}
              {currentChapter?.title || `第${activeIndex + 1}章`}
            </div>

            <iframe
              key={`${activeIndex}-${options.writingMode}-${options.lineHeight}-${options.paragraphSpacing}`}
              title="EPUB プレビュー"
              srcDoc={iframeSrcDoc}
              sandbox="allow-same-origin"
              className="block w-full border-0"
              style={{ height: "70vh", background: "#faf9f6" }}
            />
          </div>

          <p className="mt-3 text-xs text-stone-400">
            ※ 実際の Kindle 端末では端末側の文字サイズ・配色設定が優先されます。
            ここでは「あなたが指定した組み」を確認するためのプレビューです。
          </p>
        </>
      )}
    </div>
  );
}

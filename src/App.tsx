import { useEffect, useMemo, useState } from "react";
import Stepper from "./components/Stepper";
import StepUpload from "./components/StepUpload";
import StepMetadata from "./components/StepMetadata";
import StepCover from "./components/StepCover";
import StepOptions from "./components/StepOptions";
import StepPreview from "./components/StepPreview";
import StepGenerate from "./components/StepGenerate";
import { htmlToBlocks, parseDocx } from "./lib/docx";
import { loadEpub } from "./lib/epubReader";
import {
  DEFAULT_METADATA,
  DEFAULT_OPTIONS,
  type BookMetadata,
  type ConversionOptions,
  type CoverImage,
  type EditableChapter,
  type ExtractedImage,
  type ParagraphBlock,
} from "./lib/types";

const IMAGE_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
};

const STEP_LABELS = [
  "原稿",
  "書籍情報",
  "表紙",
  "オプション",
  "プレビュー",
  "生成",
];

export default function App() {
  const [step, setStep] = useState(0);
  const [maxReached, setMaxReached] = useState(0);

  const [file, setFile] = useState<File | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [metadata, setMetadata] = useState<BookMetadata>(DEFAULT_METADATA);
  const [options, setOptions] = useState<ConversionOptions>(DEFAULT_OPTIONS);
  const [cover, setCover] = useState<CoverImage | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [chapters, setChapters] = useState<EditableChapter[]>([]);
  const [images, setImages] = useState<ExtractedImage[]>([]);
  const [parseSig, setParseSig] = useState<string>("");
  const [parseMessages, setParseMessages] = useState<string[]>([]);

  // 再パースが必要なオプション (構造に影響するもの) だけをシグネチャに含める。
  // 行間/書字方向/段落間アキは表示用なので、変更しても編集を巻き戻さない。
  const parseSigKey = useMemo(
    () =>
      `${arrayBuffer ? arrayBuffer.byteLength : 0}-${options.splitByHeading}-${options.includeChapterTitle}`,
    [arrayBuffer, options.splitByHeading, options.includeChapterTitle],
  );

  useEffect(() => {
    if (!arrayBuffer) return;
    if (parseSigKey === parseSig) return;
    let cancelled = false;
    (async () => {
      const parsed = await parseDocx(arrayBuffer.slice(0), options);
      if (cancelled) return;
      setChapters(
        parsed.chapters.map((c) => ({
          id: c.id,
          filename: c.filename,
          title: c.title,
          blocks: htmlToBlocks(c.html),
        })),
      );
      setImages(parsed.images);
      setParseMessages(parsed.messages);
      setParseSig(parseSigKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [arrayBuffer, parseSigKey, parseSig, options]);

  const goto = (next: number) => {
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
  };

  const canProceed = useMemo(() => {
    switch (step) {
      case 0:
        // .docx は arrayBuffer 経由でパース、.epub は直接 chapters に入る
        return !!file && (!!arrayBuffer || chapters.length > 0);
      case 1:
        return metadata.title.trim() !== "" && metadata.author.trim() !== "";
      default:
        return true;
    }
  }, [step, file, arrayBuffer, chapters.length, metadata]);

  const handleFile = async (f: File) => {
    setFile(f);

    if (/\.epub$/i.test(f.name)) {
      // EPUB 編集モード: 解凍してメタデータ・章・画像・表紙を復元
      try {
        const loaded = await loadEpub(f);
        // arrayBuffer は使わない (再パースしない) ので null で OK
        setArrayBuffer(null);

        setMetadata((m) => ({
          ...m,
          ...Object.fromEntries(
            Object.entries(loaded.metadata).filter(
              ([, v]) => v !== undefined && v !== "",
            ),
          ),
          title:
            loaded.metadata.title ||
            m.title ||
            f.name.replace(/\.epub$/i, ""),
        }));
        setOptions((o) => ({ ...o, ...loaded.options }));
        setChapters(loaded.chapters);
        setImages(loaded.images);
        if (loaded.cover) {
          setCover(loaded.cover);
          const blob = new Blob([loaded.cover.data], {
            type: loaded.cover.mediaType,
          });
          setCoverPreview(URL.createObjectURL(blob));
        }
        setParseMessages(loaded.warnings);
        // 再パースを抑止するため、現在のシグネチャを採用済みとマーク
        setParseSig("__epub_loaded__");
      } catch (e) {
        console.error(e);
        setParseMessages([
          e instanceof Error
            ? `EPUB 読み込みエラー: ${e.message}`
            : "EPUB を読み込めませんでした。",
        ]);
      }
      return;
    }

    // 既存の Word(.docx) フロー
    setArrayBuffer(await f.arrayBuffer());
    if (!metadata.title) {
      setMetadata((m) => ({ ...m, title: f.name.replace(/\.docx$/i, "") }));
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-b from-stone-50 to-stone-100 text-stone-900">
      <header className="border-b border-stone-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-5 py-4">
          <div>
            <h1 className="text-lg font-bold tracking-tight">原稿を、本にする</h1>
            <p className="text-xs text-stone-500">
              Word → Kindle EPUB3 変換ツール
            </p>
          </div>
          <span className="rounded-full bg-stone-100 px-3 py-1 text-xs text-stone-500">
            🔒 ブラウザ内処理
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-8">
        <div className="mb-6">
          <Stepper
            steps={STEP_LABELS}
            current={step}
            maxReached={maxReached}
            onJump={goto}
          />
        </div>

        <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          {step === 0 && <StepUpload file={file} onFile={handleFile} />}
          {step === 1 && (
            <StepMetadata metadata={metadata} onChange={setMetadata} />
          )}
          {step === 2 && (
            <StepCover
              cover={cover}
              previewUrl={coverPreview}
              onCover={(c, url) => {
                setCover(c);
                setCoverPreview(url);
              }}
            />
          )}
          {step === 3 && (
            <StepOptions options={options} onChange={setOptions} />
          )}
          {step === 4 && (
            <StepPreview
              chapters={chapters}
              images={images}
              metadata={metadata}
              options={options}
              onChange={setChapters}
              onAddImage={async (chapterIndex, blockIndex, file) => {
                const buf = await file.arrayBuffer();
                const data = new Uint8Array(buf);
                const mediaType = file.type || "image/png";
                const ext = IMAGE_EXT[mediaType] ?? "png";
                const seq = images.length + 1;
                const filename = `user-image-${seq}.${ext}`;
                const id = `userimg${seq}`;
                const newImage: ExtractedImage = {
                  id,
                  filename,
                  mediaType,
                  data,
                };
                const newBlock: ParagraphBlock = {
                  id: `img-${Date.now()}`,
                  tag: "p",
                  outerHtml: `<p style="text-align:center;text-indent:0;margin:1em 0;"><img src="../images/${filename}" alt=""/></p>`,
                };
                setImages([...images, newImage]);
                setChapters(
                  chapters.map((c, i) =>
                    i === chapterIndex
                      ? {
                          ...c,
                          blocks: [
                            ...c.blocks.slice(0, blockIndex),
                            newBlock,
                            ...c.blocks.slice(blockIndex),
                          ],
                        }
                      : c,
                  ),
                );
              }}
            />
          )}
          {step === 5 && (
            <StepGenerate
              chapters={chapters}
              images={images}
              metadata={metadata}
              options={options}
              cover={cover}
              parseMessages={parseMessages}
            />
          )}

          <div className="mt-8 flex items-center justify-between border-t border-stone-100 pt-5">
            <button
              type="button"
              disabled={step === 0}
              onClick={() => goto(step - 1)}
              className="rounded-lg px-4 py-2 text-sm text-stone-600 transition hover:bg-stone-100 disabled:opacity-40"
            >
              ← 戻る
            </button>
            {step < STEP_LABELS.length - 1 ? (
              <button
                type="button"
                disabled={!canProceed}
                onClick={() => goto(step + 1)}
                className="rounded-lg bg-stone-900 px-6 py-2 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-40"
              >
                次へ →
              </button>
            ) : (
              <span className="text-xs text-stone-400">最終ステップ</span>
            )}
          </div>
        </section>

        <p className="mt-6 text-center text-xs text-stone-400">
          すべての変換処理はあなたのブラウザ内で完結します。原稿・画像が外部サーバーへ送信されることはありません。
        </p>
      </main>
    </div>
  );
}

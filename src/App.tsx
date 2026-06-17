import { useMemo, useState } from "react";
import Stepper from "./components/Stepper";
import StepUpload from "./components/StepUpload";
import StepMetadata from "./components/StepMetadata";
import StepCover from "./components/StepCover";
import StepOptions from "./components/StepOptions";
import StepPreview from "./components/StepPreview";
import StepGenerate from "./components/StepGenerate";
import {
  DEFAULT_METADATA,
  DEFAULT_OPTIONS,
  type BookMetadata,
  type ConversionOptions,
  type CoverImage,
} from "./lib/types";

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

  const goto = (next: number) => {
    setStep(next);
    setMaxReached((m) => Math.max(m, next));
  };

  const canProceed = useMemo(() => {
    switch (step) {
      case 0:
        return !!file && !!arrayBuffer;
      case 1:
        return metadata.title.trim() !== "" && metadata.author.trim() !== "";
      default:
        return true;
    }
  }, [step, file, arrayBuffer, metadata]);

  const handleFile = async (f: File) => {
    setFile(f);
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
              arrayBuffer={arrayBuffer}
              metadata={metadata}
              options={options}
            />
          )}
          {step === 5 && (
            <StepGenerate
              arrayBuffer={arrayBuffer}
              metadata={metadata}
              options={options}
              cover={cover}
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

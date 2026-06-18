import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { previewStageCss } from "../lib/epub";
import type {
  BookMetadata,
  ConversionOptions,
  EditableChapter,
  ExtractedImage,
  ParagraphBlock,
} from "../lib/types";

interface StepPreviewProps {
  chapters: EditableChapter[];
  images: ExtractedImage[];
  metadata: BookMetadata;
  options: ConversionOptions;
  onChange: (next: EditableChapter[]) => void;
  onAddImage: (
    chapterIndex: number,
    blockIndex: number,
    file: File,
  ) => Promise<void> | void;
}

function buildImageUrls(images: ExtractedImage[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const img of images) {
    const buf = new ArrayBuffer(img.data.byteLength);
    new Uint8Array(buf).set(img.data);
    const blob = new Blob([buf], { type: img.mediaType });
    map[img.filename] = URL.createObjectURL(blob);
  }
  return map;
}

function rewriteImg(html: string, urls: Record<string, string>): string {
  return html.replace(
    /src="\.\.\/images\/([^"]+)"/g,
    (m, name: string) => (urls[name] ? `src="${urls[name]}"` : m),
  );
}

let blockIdSeed = 1000;
function nextBlockId(): string {
  blockIdSeed++;
  return `u${blockIdSeed}`;
}

/** ブロックの outerHTML から「内側のテキスト or HTML」を抽出して contenteditable で扱えるようにする */
function blockInnerHtml(block: ParagraphBlock): string {
  if (block.tag === "EMPTY") return "";
  const m = block.outerHtml.match(/^<[^>]+>([\s\S]*)<\/[^>]+>$/);
  return m ? m[1] : block.outerHtml;
}

/** 編集後の innerHTML を、元のタグでくるんで outerHtml に戻す */
function rebuildOuterHtml(block: ParagraphBlock, innerHtml: string): string {
  if (block.tag === "EMPTY") return "";
  const openMatch = block.outerHtml.match(/^<[^>]+>/);
  const open = openMatch ? openMatch[0] : `<${block.tag}>`;
  return `${open}${innerHtml}</${block.tag}>`;
}

export default function StepPreview({
  chapters,
  images,
  metadata,
  options,
  onChange,
  onAddImage,
}: StepPreviewProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [pendingImageIndex, setPendingImageIndex] = useState<number | null>(
    null,
  );
  const imageUrlsRef = useRef<Record<string, string>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Object.values(imageUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    imageUrlsRef.current = buildImageUrls(images);
    return () => {
      Object.values(imageUrlsRef.current).forEach((u) =>
        URL.revokeObjectURL(u),
      );
      imageUrlsRef.current = {};
    };
  }, [images]);

  useEffect(() => {
    if (activeIndex >= chapters.length && chapters.length > 0) {
      setActiveIndex(0);
    }
  }, [chapters.length, activeIndex]);

  const css = useMemo(() => previewStageCss(options), [options]);
  const currentChapter = chapters[activeIndex];

  const updateBlocks = (
    updater: (blocks: ParagraphBlock[]) => ParagraphBlock[],
  ) => {
    if (!currentChapter) return;
    const nextBlocks = updater(currentChapter.blocks);
    const next = chapters.map((c, i) =>
      i === activeIndex ? { ...c, blocks: nextBlocks } : c,
    );
    onChange(next);
  };

  const insertEmptyAt = (index: number) => {
    updateBlocks((blocks) => {
      const copy = [...blocks];
      copy.splice(index, 0, { id: nextBlockId(), tag: "EMPTY", outerHtml: "" });
      return copy;
    });
  };

  const triggerImageInsert = (index: number) => {
    setPendingImageIndex(index);
    fileInputRef.current?.click();
  };

  const onFileSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && pendingImageIndex !== null) {
      await onAddImage(activeIndex, pendingImageIndex, file);
      setPendingImageIndex(null);
    }
    e.target.value = "";
  };

  const removeBlock = (id: string) => {
    updateBlocks((blocks) => blocks.filter((b) => b.id !== id));
  };

  const updateBlockHtml = (id: string, innerHtml: string) => {
    updateBlocks((blocks) =>
      blocks.map((b) =>
        b.id === id ? { ...b, outerHtml: rebuildOuterHtml(b, innerHtml) } : b,
      ),
    );
  };

  if (chapters.length === 0) {
    return (
      <div>
        <h2 className="text-xl font-bold text-stone-900">5. プレビューと編集</h2>
        <div className="mt-5 rounded-xl border border-stone-200 bg-stone-50 px-4 py-6 text-center text-sm text-stone-500">
          原稿（.docx）をアップロードしてください。
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-stone-900">5. プレビューと編集</h2>
      <p className="mt-1 text-sm text-stone-500">
        いまの設定で EPUB がどう表示されるか確認できます。編集モードをONにすると、
        段落の追加・削除・文字直しができます（元のWord原稿は変更されません）。
      </p>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {chapters.length > 1 &&
          chapters.map((ch, i) => (
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
        <label className="ml-auto flex cursor-pointer items-center gap-2 rounded-lg border border-stone-300 px-3 py-1.5 text-xs text-stone-700 hover:bg-stone-100">
          <input
            type="checkbox"
            checked={editMode}
            onChange={(e) => setEditMode(e.target.checked)}
            className="h-4 w-4 rounded border-stone-300 accent-stone-900"
          />
          <span>✏️ 編集モード</span>
        </label>
      </div>

      <div className="mt-3 flex items-center gap-2 text-xs text-stone-500">
        <span className="rounded-full bg-stone-100 px-2 py-1">
          全 {chapters.length} 章
        </span>
        <span className="rounded-full bg-stone-100 px-2 py-1">
          {options.writingMode === "vertical" ? "縦書き" : "横書き"}
        </span>
        {editMode && (
          <span className="rounded-full bg-amber-100 px-2 py-1 text-amber-800">
            編集モード ON
          </span>
        )}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-stone-300 bg-white shadow-inner">
        <div className="border-b border-stone-200 bg-stone-50 px-4 py-2 text-xs text-stone-500">
          📖 {metadata.title || "（タイトル未設定）"} ・{" "}
          {currentChapter?.title || `第${activeIndex + 1}章`}
        </div>

        <style>{css}</style>
        <div
          className="epub-stage overflow-auto bg-[#faf9f6] p-5"
          style={{
            height: "70vh",
          }}
        >
          {currentChapter && (
            <BlockList
              blocks={currentChapter.blocks}
              imageUrls={imageUrlsRef.current}
              editMode={editMode}
              onInsertEmptyAt={insertEmptyAt}
              onInsertImageAt={triggerImageInsert}
              onRemove={removeBlock}
              onEdit={updateBlockHtml}
            />
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        onChange={onFileSelected}
        className="hidden"
      />

      <p className="mt-3 text-xs text-stone-400">
        ※ 編集モードで段落を追加・削除・編集した内容は、EPUB
        を生成するときに反映されます。元の Word ファイルには影響しません。
      </p>
    </div>
  );
}

interface BlockListProps {
  blocks: ParagraphBlock[];
  imageUrls: Record<string, string>;
  editMode: boolean;
  onInsertEmptyAt: (index: number) => void;
  onInsertImageAt: (index: number) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string, innerHtml: string) => void;
}

function BlockList({
  blocks,
  imageUrls,
  editMode,
  onInsertEmptyAt,
  onInsertImageAt,
  onRemove,
  onEdit,
}: BlockListProps) {
  return (
    <div>
      {editMode && (
        <InsertSlot
          onInsertEmpty={() => onInsertEmptyAt(0)}
          onInsertImage={() => onInsertImageAt(0)}
        />
      )}
      {blocks.map((b, i) => (
        <div key={b.id}>
          <BlockView
            block={b}
            imageUrls={imageUrls}
            editMode={editMode}
            onRemove={() => onRemove(b.id)}
            onEdit={(html) => onEdit(b.id, html)}
          />
          {editMode && (
            <InsertSlot
              onInsertEmpty={() => onInsertEmptyAt(i + 1)}
              onInsertImage={() => onInsertImageAt(i + 1)}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function InsertSlot({
  onInsertEmpty,
  onInsertImage,
}: {
  onInsertEmpty: () => void;
  onInsertImage: () => void;
}) {
  return (
    <div className="group my-0.5 flex w-full items-center justify-center gap-1 py-1 text-[10px] text-stone-300">
      <span className="h-px flex-1 bg-stone-200 group-hover:bg-stone-400" />
      <button
        type="button"
        onClick={onInsertEmpty}
        className="rounded-full border border-stone-200 bg-white px-2 py-0.5 transition hover:border-stone-400 hover:text-stone-700"
      >
        ＋ 空白行
      </button>
      <button
        type="button"
        onClick={onInsertImage}
        className="rounded-full border border-stone-200 bg-white px-2 py-0.5 transition hover:border-emerald-400 hover:text-emerald-700"
      >
        🖼 画像
      </button>
      <span className="h-px flex-1 bg-stone-200 group-hover:bg-stone-400" />
    </div>
  );
}

interface BlockViewProps {
  block: ParagraphBlock;
  imageUrls: Record<string, string>;
  editMode: boolean;
  onRemove: () => void;
  onEdit: (innerHtml: string) => void;
}

function BlockView({
  block,
  imageUrls,
  editMode,
  onRemove,
  onEdit,
}: BlockViewProps) {
  const ref = useRef<HTMLDivElement>(null);
  const initialInner = useMemo(
    () => rewriteImg(blockInnerHtml(block), imageUrls),
    [block, imageUrls],
  );

  // 表示用 HTML を outerHtml ベースで組み立てる (画像 src は preview 用に書き換え)
  const displayHtml = useMemo(() => {
    if (block.tag === "EMPTY") {
      return '<p class="empty-marker"></p>';
    }
    return rewriteImg(block.outerHtml, imageUrls);
  }, [block, imageUrls]);

  if (!editMode) {
    return (
      <div
        className="block-display"
        dangerouslySetInnerHTML={{ __html: displayHtml }}
      />
    );
  }

  // EMPTY ブロックは編集モードでは「空白行」として可視化＆削除可
  if (block.tag === "EMPTY") {
    return (
      <div className="group relative my-1 rounded border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700">
        空白行（読書時はここで一拍空きます）
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 hidden rounded bg-white px-1.5 py-0.5 text-[10px] text-red-600 shadow group-hover:inline-block"
        >
          ✕ 削除
        </button>
      </div>
    );
  }

  // 画像入りブロックは編集モードでも contenteditable にせず削除のみ
  const isImageBlock = /<img\b/i.test(block.outerHtml);
  if (isImageBlock) {
    return (
      <div className="group relative my-1 rounded border border-dashed border-emerald-300 bg-emerald-50/40 p-2">
        <div dangerouslySetInnerHTML={{ __html: displayHtml }} />
        <button
          type="button"
          onClick={onRemove}
          className="absolute right-1 top-1 hidden rounded bg-white px-1.5 py-0.5 text-[10px] text-red-600 shadow group-hover:inline-block"
          title="この画像を削除"
        >
          ✕ 削除
        </button>
      </div>
    );
  }

  return (
    <div className="group relative rounded transition hover:bg-amber-50/50">
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onBlur={() => {
          if (ref.current) onEdit(ref.current.innerHTML);
        }}
        className="block-editable outline-none focus:bg-amber-50"
        // 表示は内側のみ。タグ自体は周囲で再構築する
        dangerouslySetInnerHTML={{ __html: initialInner }}
      />
      <button
        type="button"
        onClick={onRemove}
        className="absolute right-1 top-1 hidden rounded bg-white px-1.5 py-0.5 text-[10px] text-red-600 shadow group-hover:inline-block"
        title="この段落を削除"
      >
        ✕ 削除
      </button>
    </div>
  );
}

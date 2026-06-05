import type { BookMetadata } from "../lib/types";

interface StepMetadataProps {
  metadata: BookMetadata;
  onChange: (next: BookMetadata) => void;
}

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-stone-700">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-stone-400">{hint}</span>}
    </label>
  );
}

const inputCls =
  "mt-1 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm outline-none focus:border-stone-900 focus:ring-1 focus:ring-stone-900";

export default function StepMetadata({
  metadata,
  onChange,
}: StepMetadataProps) {
  const set = (patch: Partial<BookMetadata>) =>
    onChange({ ...metadata, ...patch });

  return (
    <div>
      <h2 className="text-xl font-bold text-stone-900">2. 書籍情報</h2>
      <p className="mt-1 text-sm text-stone-500">
        Kindle に表示されるメタデータです。タイトルと著者名は必須。
      </p>

      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Field label="タイトル" required>
            <input
              className={inputCls}
              value={metadata.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="例）はじめての電子出版"
            />
          </Field>
        </div>
        <Field label="サブタイトル">
          <input
            className={inputCls}
            value={metadata.subtitle}
            onChange={(e) => set({ subtitle: e.target.value })}
          />
        </Field>
        <Field label="著者名" required>
          <input
            className={inputCls}
            value={metadata.author}
            onChange={(e) => set({ author: e.target.value })}
            placeholder="例）山田 太郎"
          />
        </Field>
        <Field label="出版元 / レーベル">
          <input
            className={inputCls}
            value={metadata.publisher}
            onChange={(e) => set({ publisher: e.target.value })}
          />
        </Field>
        <Field label="言語">
          <select
            className={inputCls}
            value={metadata.language}
            onChange={(e) => set({ language: e.target.value })}
          >
            <option value="ja">日本語 (ja)</option>
            <option value="en">英語 (en)</option>
          </select>
        </Field>
        <Field
          label="ISBN / 識別子"
          hint="未入力の場合は自動で一意のUUIDを付与します"
        >
          <input
            className={inputCls}
            value={metadata.identifier}
            onChange={(e) => set({ identifier: e.target.value })}
            placeholder="978-4-..."
          />
        </Field>
        <div className="sm:col-span-2">
          <Field label="書籍紹介文">
            <textarea
              className={`${inputCls} h-24 resize-y`}
              value={metadata.description}
              onChange={(e) => set({ description: e.target.value })}
            />
          </Field>
        </div>
      </div>
    </div>
  );
}

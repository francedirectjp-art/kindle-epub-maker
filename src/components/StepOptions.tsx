import type { ConversionOptions } from "../lib/types";

interface StepOptionsProps {
  options: ConversionOptions;
  onChange: (next: ConversionOptions) => void;
}

function Toggle({
  checked,
  onChange,
  title,
  desc,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  desc: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-stone-200 p-4 hover:bg-stone-50">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 rounded border-stone-300 accent-stone-900"
      />
      <span>
        <span className="block font-medium text-stone-800">{title}</span>
        <span className="block text-sm text-stone-500">{desc}</span>
      </span>
    </label>
  );
}

export default function StepOptions({ options, onChange }: StepOptionsProps) {
  const set = (patch: Partial<ConversionOptions>) =>
    onChange({ ...options, ...patch });

  return (
    <div>
      <h2 className="text-xl font-bold text-stone-900">4. 変換オプション</h2>
      <p className="mt-1 text-sm text-stone-500">
        EPUB の構成を調整します。迷ったら初期設定のままで大丈夫です。
      </p>

      <div className="mt-5 space-y-3">
        <Toggle
          checked={options.splitByHeading}
          onChange={(v) => set({ splitByHeading: v })}
          title="見出し1で章を自動分割"
          desc="Word の「見出し 1」スタイルごとに章ファイルを分けます。"
        />
        <Toggle
          checked={options.includeChapterTitle}
          onChange={(v) => set({ includeChapterTitle: v })}
          title="本文先頭に章見出しを表示"
          desc="各章ページの先頭に見出しテキストを出力します。"
        />

        <div className="rounded-xl border border-stone-200 p-4">
          <span className="block font-medium text-stone-800">組み方向</span>
          <span className="block text-sm text-stone-500">
            縦書きを選ぶと右綴じ・縦組みの EPUB を生成します。
          </span>
          <div className="mt-3 flex gap-2">
            {(
              [
                ["horizontal", "横書き"],
                ["vertical", "縦書き"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => set({ writingMode: value })}
                className={[
                  "rounded-lg border px-4 py-2 text-sm transition",
                  options.writingMode === value
                    ? "border-stone-900 bg-stone-900 text-white"
                    : "border-stone-300 text-stone-700 hover:bg-stone-100",
                ].join(" ")}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

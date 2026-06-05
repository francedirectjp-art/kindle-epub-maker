interface StepperProps {
  steps: string[];
  current: number;
  onJump: (index: number) => void;
  maxReached: number;
}

export default function Stepper({
  steps,
  current,
  onJump,
  maxReached,
}: StepperProps) {
  return (
    <ol className="flex w-full items-center gap-1 sm:gap-2">
      {steps.map((label, i) => {
        const state =
          i === current ? "current" : i < current ? "done" : "upcoming";
        const reachable = i <= maxReached;
        return (
          <li key={label} className="flex flex-1 items-center">
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onJump(i)}
              className={[
                "flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 text-center transition",
                reachable ? "cursor-pointer hover:bg-stone-100" : "cursor-not-allowed opacity-50",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold",
                  state === "current"
                    ? "bg-stone-900 text-white"
                    : state === "done"
                      ? "bg-emerald-600 text-white"
                      : "bg-stone-200 text-stone-500",
                ].join(" ")}
              >
                {state === "done" ? "✓" : i + 1}
              </span>
              <span
                className={[
                  "text-[11px] leading-tight sm:text-xs",
                  state === "current"
                    ? "font-semibold text-stone-900"
                    : "text-stone-500",
                ].join(" ")}
              >
                {label}
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

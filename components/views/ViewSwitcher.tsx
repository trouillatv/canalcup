"use client";

const VIEW_META: Record<string, { icon: string; label: string }> = {
  standard: { icon: "☰", label: "Standard" },
  bracket: { icon: "🔢", label: "Tableau" },
  fifa: { icon: "🏆", label: "FIFA" },
  tv: { icon: "📺", label: "TV" },
  compact: { icon: "⚡", label: "Compact" },
};

export function ViewSwitcher({
  view,
  onChange,
  modes,
}: {
  view: string;
  onChange: (v: string) => void;
  modes: string[];
}) {
  return (
    <div className="flex items-center gap-0.5 bg-canal-gray-mid rounded-xl p-1 shrink-0">
      {modes.map((m) => {
        const meta = VIEW_META[m] ?? { icon: "•", label: m };
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              m === view
                ? "bg-canal-yellow text-canal-black"
                : "text-canal-gray-muted hover:text-white"
            }`}
          >
            <span>{meta.icon}</span>
            <span className="hidden sm:inline">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}

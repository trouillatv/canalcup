import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export function PronoReminder({ count }: { count: number }) {
  return (
    <Link href="/matches" className="block">
      <div className="rounded-2xl border border-orange-500/40 bg-orange-950/20 px-4 py-3 flex items-center gap-3 hover:bg-orange-950/30 transition-colors">
        <AlertTriangle size={18} className="text-orange-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-white text-sm">
            {count} match{count > 1 ? "s" : ""} sans pronostic
          </p>
          <p className="text-orange-300/70 text-xs mt-0.5">
            Pronos ouverts — chaque match rapporte des points !
          </p>
        </div>
        <span className="text-orange-400 text-xs font-bold shrink-0">Voter →</span>
      </div>
    </Link>
  );
}

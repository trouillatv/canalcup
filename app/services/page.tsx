import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getServiceLeaderboard } from "@/lib/data/users";
import { Shield, TrendingUp, ArrowRight } from "lucide-react";

export const revalidate = 60;

export default async function ServicesPage() {
  const supabase = await createClient();
  const [{ data: services }, rows] = await Promise.all([
    supabase.from("services").select("id, name, emoji, is_active, sort_order").eq("is_active", true).order("sort_order"),
    getServiceLeaderboard(),
  ]);

  const byId = new Map(rows.map((row) => [row.service.id, row]));

  return (
    <div className="px-4 py-4 space-y-5 max-w-3xl mx-auto">
      <header className="canal-card border border-canal-yellow/20 bg-gradient-to-br from-canal-yellow/10 to-transparent">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-canal-yellow font-black text-xs uppercase tracking-wider flex items-center gap-1.5">
              <Shield size={13} /> Services
            </p>
            <h1 className="text-2xl font-black text-white mt-1">Les services Canal Cup</h1>
            <p className="text-sm text-canal-gray-muted mt-1 max-w-xl">
              Classement par moyenne de points. Ouvre un service pour voir ses participants, ses forces et ses points.
            </p>
          </div>
          <div className="shrink-0 rounded-2xl border border-canal-gray-light bg-canal-gray-mid px-3 py-2 text-right">
            <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">Services actifs</p>
            <p className="text-2xl font-black text-canal-yellow tabular-nums">{services?.length ?? 0}</p>
          </div>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {(services ?? []).map((service) => {
          const row = byId.get(service.id);
          return (
            <Link
              key={service.id}
              href={`/services/${service.id}`}
              className="canal-card group border border-canal-gray-light hover:border-canal-yellow/30 hover:bg-canal-gray-mid transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-2xl bg-canal-yellow/10 border border-canal-yellow/20 flex items-center justify-center text-2xl">
                  {service.emoji ?? "🏢"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="font-black text-white truncate">{service.name}</h2>
                    {row?.rank === 1 && (
                      <span className="rounded-full bg-canal-yellow text-canal-black px-2 py-0.5 text-[10px] font-black">
                        #1
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-canal-gray-muted mt-0.5">
                    {row ? `${row.members} participant${row.members > 1 ? "s" : ""}` : "Aucun participant classé"}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl bg-canal-gray-mid px-2 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">Moyenne</p>
                      <p className="text-canal-yellow font-black tabular-nums">{row?.average ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-canal-gray-mid px-2 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">Total</p>
                      <p className="text-white font-black tabular-nums">{row?.total ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-canal-gray-mid px-2 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-canal-gray-muted font-bold">Rang</p>
                      <p className="text-white font-black tabular-nums">{row?.rank ?? "—"}</p>
                    </div>
                  </div>
                </div>
                <ArrowRight size={16} className="text-canal-gray-muted group-hover:text-canal-yellow transition-colors shrink-0 mt-1" />
              </div>
            </Link>
          );
        })}
      </div>

      <div className="canal-card border border-canal-gray-light">
        <div className="flex items-center gap-2 text-canal-gray-muted text-sm">
          <TrendingUp size={14} className="text-canal-yellow" />
          <span>Les services sont comparés à la moyenne, pas au total brut.</span>
        </div>
      </div>
    </div>
  );
}

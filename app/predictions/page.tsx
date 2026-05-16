"use client";

import { useState, useEffect } from "react";
import { Trophy, Star, Zap } from "lucide-react";

const WC_TEAMS = [
  "Mexico","South Africa","South Korea","Czech Republic","Canada","Bosnia-Herzegovina",
  "USA","Paraguay","Brazil","Morocco","Qatar","Switzerland","Haiti","Scotland",
  "Germany","Curaçao","Ivory Coast","Ecuador","Netherlands","Japan","Australia",
  "Turkey","Belgium","Egypt","Saudi Arabia","Uruguay","Spain","Cape Verde","Sweden","Tunisia",
];

const FLAGS: Record<string, string> = {
  Mexico:"🇲🇽","South Africa":"🇿🇦","South Korea":"🇰🇷","Czech Republic":"🇨🇿",
  Canada:"🇨🇦","Bosnia-Herzegovina":"🇧🇦","USA":"🇺🇸","Paraguay":"🇵🇾",
  Brazil:"🇧🇷","Morocco":"🇲🇦","Qatar":"🇶🇦","Switzerland":"🇨🇭","Haiti":"🇭🇹",
  Scotland:"🏴󠁧󠁢󠁳󠁣󠁴󠁿","Germany":"🇩🇪","Curaçao":"🇨🇼","Ivory Coast":"🇨🇮",
  Ecuador:"🇪🇨","Netherlands":"🇳🇱","Japan":"🇯🇵","Australia":"🇦🇺","Turkey":"🇹🇷",
  Belgium:"🇧🇪","Egypt":"🇪🇬","Saudi Arabia":"🇸🇦","Uruguay":"🇺🇾","Spain":"🇪🇸",
  "Cape Verde":"🇨🇻","Sweden":"🇸🇪","Tunisia":"🇹🇳",
};

interface BonusPredictions {
  winner?: string;
  top_scorer?: string;
}

export default function PredictionsPage() {
  const [saved, setSaved] = useState<BonusPredictions>({});
  const [winner, setWinner] = useState("");
  const [topScorer, setTopScorer] = useState("");
  const [saving, setSaving] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/predictions/bonus")
      .then((r) => r.json())
      .then((d) => {
        if (d.predictions) {
          const w = d.predictions.find((p: {prediction_type: string}) => p.prediction_type === "winner");
          const ts = d.predictions.find((p: {prediction_type: string}) => p.prediction_type === "top_scorer");
          if (w) { setSaved((s) => ({ ...s, winner: w.predicted_value })); setWinner(w.predicted_value); }
          if (ts) { setSaved((s) => ({ ...s, top_scorer: ts.predicted_value })); setTopScorer(ts.predicted_value); }
        }
      })
      .catch(() => {});
  }, []);

  const save = async (type: "winner" | "top_scorer", value: string) => {
    if (!value) return;
    setSaving(type);
    await fetch("/api/predictions/bonus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prediction_type: type, predicted_value: value }),
    });
    setSaving(null);
    setDone((d) => ({ ...d, [type]: true }));
    setSaved((s) => ({ ...s, [type]: value }));
    setTimeout(() => setDone((d) => ({ ...d, [type]: false })), 2000);
  };

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl">Pronostics Spéciaux</h1>
        <p className="text-canal-gray-muted text-sm mt-1">Bonus points si vous voyez juste</p>
      </div>

      {/* Vainqueur */}
      <div className="canal-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-canal-yellow/10 rounded-xl flex items-center justify-center">
            <Trophy size={20} className="text-canal-yellow" />
          </div>
          <div>
            <p className="font-black text-white">Vainqueur de la Coupe du Monde</p>
            <p className="text-xs text-canal-gray-muted">+20 pts si votre équipe soulève le trophée</p>
          </div>
        </div>

        {saved.winner ? (
          <div className="flex items-center gap-3 bg-canal-gray-mid rounded-xl px-4 py-3">
            <span className="text-2xl">{FLAGS[saved.winner] ?? "🏳️"}</span>
            <span className="font-black text-white flex-1">{saved.winner}</span>
            <span className="text-canal-yellow font-black">+20 pts</span>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              {WC_TEAMS.map((team) => (
                <button
                  key={team}
                  onClick={() => setWinner(team)}
                  className={`flex items-center gap-1.5 px-2 py-2 rounded-lg text-xs font-bold transition-colors text-left ${
                    winner === team
                      ? "bg-canal-yellow text-canal-black"
                      : "bg-canal-gray-mid text-white hover:bg-canal-gray-light"
                  }`}
                >
                  <span>{FLAGS[team] ?? "🏳️"}</span>
                  <span className="truncate">{team}</span>
                </button>
              ))}
            </div>
            <button
              onClick={() => save("winner", winner)}
              disabled={!winner || saving === "winner"}
              className="w-full py-3 rounded-xl bg-canal-yellow text-canal-black font-black disabled:opacity-40 transition-opacity"
            >
              {saving === "winner" ? "Enregistrement…" : done.winner ? "✅ Sauvegardé !" : "Valider mon choix"}
            </button>
          </>
        )}
      </div>

      {/* Meilleur buteur */}
      <div className="canal-card space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-canal-yellow/10 rounded-xl flex items-center justify-center">
            <Star size={20} className="text-canal-yellow" />
          </div>
          <div>
            <p className="font-black text-white">Meilleur buteur du tournoi</p>
            <p className="text-xs text-canal-gray-muted">+10 pts si vous devinez le top scorer</p>
          </div>
        </div>

        {saved.top_scorer ? (
          <div className="flex items-center gap-3 bg-canal-gray-mid rounded-xl px-4 py-3">
            <span className="text-xl">⚽</span>
            <span className="font-black text-white flex-1">{saved.top_scorer}</span>
            <span className="text-canal-yellow font-black">+10 pts</span>
          </div>
        ) : (
          <>
            <input
              type="text"
              placeholder="Nom du joueur (ex: Mbappé, Vinicius Jr…)"
              value={topScorer}
              onChange={(e) => setTopScorer(e.target.value)}
              className="w-full bg-canal-gray-mid border border-canal-gray-light rounded-xl px-4 py-3 text-white placeholder-canal-gray-muted focus:border-canal-yellow outline-none text-sm"
            />
            <button
              onClick={() => save("top_scorer", topScorer)}
              disabled={!topScorer.trim() || saving === "top_scorer"}
              className="w-full py-3 rounded-xl bg-canal-yellow text-canal-black font-black disabled:opacity-40 transition-opacity"
            >
              {saving === "top_scorer" ? "Enregistrement…" : done.top_scorer ? "✅ Sauvegardé !" : "Valider mon choix"}
            </button>
          </>
        )}
      </div>

      {/* Série parfaite */}
      <div className="canal-card">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-canal-yellow/10 rounded-xl flex items-center justify-center">
            <Zap size={20} className="text-canal-yellow" />
          </div>
          <div>
            <p className="font-black text-white">Série parfaite</p>
            <p className="text-xs text-canal-gray-muted">+5 pts bonus pour 3 scores exacts d'affilée</p>
          </div>
        </div>
        <p className="text-xs text-canal-gray-muted mt-3">
          Ce bonus est calculé automatiquement au fil des matchs.
        </p>
      </div>

      {/* Règles de points */}
      <div className="canal-card space-y-3">
        <p className="font-black text-white text-sm uppercase tracking-wider">Barème des points</p>
        {[
          { label: "Score exact", pts: 10, mult: true, icon: "🎯" },
          { label: "Bon résultat (V/N/D)", pts: 5, mult: true, icon: "✅" },
          { label: "Bonne différence de buts", pts: 3, mult: true, icon: "↔️" },
          { label: "Mauvais pronostic", pts: 0, mult: false, icon: "❌" },
        ].map((r) => (
          <div key={r.label} className="flex items-center justify-between">
            <span className="text-sm text-canal-gray-muted">{r.icon} {r.label}</span>
            <span className={`text-sm font-black ${r.pts > 0 ? "text-canal-yellow" : "text-canal-gray-muted"}`}>
              {r.pts > 0 ? `+${r.pts} pts` : "0 pt"}
              {r.mult && r.pts > 0 && <span className="text-xs font-normal text-canal-gray-muted ml-1">× phase</span>}
            </span>
          </div>
        ))}
        <div className="border-t border-canal-gray-light pt-3 space-y-1">
          {[
            ["Phase de groupes", "×1"],
            ["Huitièmes", "×1.5"],
            ["Quarts", "×2"],
            ["Demies", "×2.5"],
            ["Finale", "×3"],
          ].map(([phase, mult]) => (
            <div key={phase} className="flex justify-between text-xs">
              <span className="text-canal-gray-muted">{phase}</span>
              <span className="text-white font-bold">{mult}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

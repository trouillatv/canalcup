"use client";

import { useState } from "react";
import { ChevronDown, Shirt } from "lucide-react";
import type { SquadPlayer } from "@/lib/canal-sports/match-center";
import { cn } from "@/lib/utils";

type SquadGroup = {
  label: string;
  players: SquadPlayer[];
};

type SquadDisclosureProps = {
  preview: SquadPlayer[];
  groups: SquadGroup[];
  total: number;
};

function positionLabel(position: string | null): string | null {
  const value = (position ?? "").toLowerCase();
  if (!value) return null;
  if (value.includes("goal")) return "Gardien";
  if (value.includes("def")) return "Défenseur";
  if (value.includes("mid")) return "Milieu";
  if (value.includes("attack") || value.includes("forward") || value.includes("offence")) return "Attaquant";
  return null;
}

function PlayerRow({ player }: { player: SquadPlayer }) {
  const displayPosition = positionLabel(player.position);
  return (
    <div className="flex items-center gap-2 rounded-md bg-secondary/55 px-2 py-2 transition-colors duration-150 hover:bg-secondary/80">
      <Shirt size={14} className="shrink-0 text-primary" />
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">{player.name}</span>
      {displayPosition ? <span className="shrink-0 text-[11px] text-muted-foreground">{displayPosition}</span> : null}
    </div>
  );
}

function SquadGroups({ groups }: { groups: SquadGroup[] }) {
  return (
    <>
      {groups.map((group, index) => (
        <div key={group.label} className="cs-squad-group" style={{ animationDelay: `${index * 30}ms` }}>
          <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-muted-foreground">{group.label}</p>
          <div className="space-y-2">
            {group.players.map((player) => <PlayerRow key={player.id} player={player} />)}
          </div>
        </div>
      ))}
    </>
  );
}

export function SquadDisclosure({ preview, groups, total }: SquadDisclosureProps) {
  const [open, setOpen] = useState(false);
  const canExpand = total > preview.length;

  return (
    <div className="space-y-2 lg:hidden">
      {open ? (
        <div className="cs-squad-details-content space-y-4">
          <SquadGroups groups={groups} />
        </div>
      ) : (
        <div className="space-y-2">
          {preview.map((player) => <PlayerRow key={player.id} player={player} />)}
        </div>
      )}

      {canExpand ? (
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className={cn(
            "cs-match-cta flex w-full items-center justify-between gap-3 rounded-md py-1 text-left text-xs font-black text-primary outline-none",
            "transition-colors hover:text-primary/80 focus-visible:ring-2 focus-visible:ring-primary"
          )}
        >
          <span>{open ? "Réduire l'effectif" : "Voir l'effectif complet"}</span>
          <ChevronDown size={14} className={cn("transition-transform duration-200", open && "rotate-180")} />
        </button>
      ) : null}
    </div>
  );
}

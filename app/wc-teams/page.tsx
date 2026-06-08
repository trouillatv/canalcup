import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Flag } from "@/components/shared/Flag";
import { allWCTeamsFiche } from "@/lib/football/wc-teams-index";

export const revalidate = 3600;

export default function WCTeamsPage() {
  const teams = allWCTeamsFiche();

  return (
    <div className="px-4 py-4 space-y-4 max-w-2xl mx-auto pb-24">
      <div>
        <h1 className="canal-headline text-2xl">Sélections CdM 2026</h1>
        <p className="text-canal-gray-muted text-sm mt-1">
          {teams.length} équipes qualifiées — effectifs, forme &amp; calendrier
        </p>
      </div>

      <div className="canal-card divide-y divide-canal-gray-light/30 p-0 overflow-hidden">
        {teams.map((team) => (
          <Link
            key={team.slug}
            href={`/wc-team/${team.slug}`}
            className="flex items-center gap-3 px-4 py-3 hover:bg-canal-gray-mid transition-colors group"
          >
            <Flag name={team.name} className="h-6 w-auto rounded-sm shrink-0" emojiClassName="text-2xl leading-none" />
            <span className="flex-1 font-semibold text-sm text-white group-hover:text-canal-yellow transition-colors">
              {team.name}
            </span>
            <span className="text-[11px] font-black text-canal-gray-muted bg-canal-gray-mid px-2 py-0.5 rounded-md shrink-0">
              Gr. {team.group}
            </span>
            <ArrowRight size={14} className="text-canal-gray-muted group-hover:text-canal-yellow transition-colors shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  );
}

import type { MorningBrief } from "@/lib/supabase/types";
import { Newspaper, Zap, HelpCircle, Bot } from "lucide-react";

interface BriefCardProps {
  brief: MorningBrief;
}

export function BriefCard({ brief }: BriefCardProps) {
  return (
    <div className="space-y-4">
      {/* Titre */}
      <div className="canal-card border-l-4 border-l-canal-yellow">
        <div className="flex items-center gap-2 mb-2">
          <Newspaper size={16} className="text-canal-yellow" />
          <span className="canal-badge">Édition du jour</span>
        </div>
        <h2 className="canal-headline text-xl">{brief.title}</h2>
        <p className="text-canal-gray-muted text-sm mt-2 leading-relaxed">{brief.body}</p>
      </div>

      {/* Scores */}
      {brief.scores_summary && (
        <div className="canal-card">
          <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider mb-1">Résultats</p>
          <p className="text-white font-mono text-sm">{brief.scores_summary}</p>
        </div>
      )}

      {/* Fail du jour */}
      {brief.fail_of_day && (
        <div className="canal-card border border-red-900/50 bg-red-950/20">
          <div className="flex items-center gap-2 mb-1">
            <Zap size={14} className="text-red-400" />
            <span className="text-xs font-bold text-red-400 uppercase">Fail du jour</span>
          </div>
          <p className="text-white text-sm italic leading-relaxed">"{brief.fail_of_day}"</p>
        </div>
      )}

      {/* Fun fact */}
      {brief.fun_fact && (
        <div className="canal-card">
          <div className="flex items-center gap-2 mb-1">
            <HelpCircle size={14} className="text-blue-400" />
            <span className="text-xs font-bold text-blue-400 uppercase">Le saviez-vous ?</span>
          </div>
          <p className="text-white text-sm leading-relaxed">{brief.fun_fact}</p>
        </div>
      )}

      {/* Coach IA */}
      {brief.ai_comment && (
        <div className="canal-card bg-gradient-to-r from-canal-gray to-canal-gray-mid">
          <div className="flex items-center gap-2 mb-1">
            <Bot size={14} className="text-canal-yellow" />
            <span className="text-xs font-bold text-canal-yellow uppercase">Le Coach IA</span>
          </div>
          <p className="text-white text-sm italic leading-relaxed">"{brief.ai_comment}"</p>
        </div>
      )}
    </div>
  );
}

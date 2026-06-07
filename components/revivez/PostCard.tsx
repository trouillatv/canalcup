"use client";

import { useState } from "react";
import type { RevivezPost } from "@/lib/supabase/types";
import { cn } from "@/lib/utils";
import { LocalTime } from "@/components/timezone/LocalTime";
import { Heart, Quote, Camera, Trophy, Bot, Zap } from "lucide-react";

const TYPE_CONFIG = {
  phrase: { icon: Quote, label: "Phrase culte", color: "text-blue-400", bg: "bg-blue-950/30" },
  fail: { icon: Zap, label: "Fail légendaire", color: "text-red-400", bg: "bg-red-950/30" },
  photo: { icon: Camera, label: "Photo", color: "text-green-400", bg: "bg-green-950/30" },
  babyfoot: { icon: Trophy, label: "Babyfoot", color: "text-canal-yellow", bg: "bg-yellow-950/20" },
  roast: { icon: Bot, label: "Coach IA", color: "text-purple-400", bg: "bg-purple-950/30" },
};

interface PostCardProps {
  post: RevivezPost;
  onVote?: (postId: string) => void;
}

export function PostCard({ post, onVote }: PostCardProps) {
  const [voted, setVoted] = useState(false);
  const [localVotes, setLocalVotes] = useState(post.votes_count);
  const config = TYPE_CONFIG[post.type];
  const Icon = config.icon;

  const handleVote = () => {
    if (voted) return;
    setVoted(true);
    setLocalVotes((v) => v + 1);
    onVote?.(post.id);
  };

  return (
    <article className={cn("canal-card", config.bg, "border-l-2")}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className={config.color} />
          <span className={cn("text-xs font-bold uppercase tracking-wide", config.color)}>
            {config.label}
          </span>
        </div>
        {post.team && (
          <span className="text-xs text-canal-gray-muted">{post.team.name}</span>
        )}
      </div>

      {/* Titre */}
      <h3 className="font-bold text-white mb-1">{post.title}</h3>

      {/* Contenu */}
      <p className="text-canal-gray-muted text-sm leading-relaxed italic">{post.content}</p>

      {/* Image si présente */}
      {post.image_url && (
        <div className="mt-3 rounded-lg overflow-hidden">
          <img src={post.image_url} alt={post.title} className="w-full object-cover max-h-48" />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-canal-gray-light">
        <span className="text-xs text-canal-gray-muted">
          <LocalTime date={post.created_at} variant="date" />
        </span>
        <button
          onClick={handleVote}
          className={cn(
            "flex items-center gap-1.5 text-sm font-bold transition-all",
            voted ? "text-red-400" : "text-canal-gray-muted hover:text-red-400"
          )}
        >
          <Heart size={16} fill={voted ? "currentColor" : "none"} />
          <span>{localVotes}</span>
        </button>
      </div>
    </article>
  );
}

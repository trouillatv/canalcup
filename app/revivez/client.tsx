"use client";

import { useState } from "react";
import { PostCard } from "@/components/revivez/PostCard";
import type { RevivezPost, RevivezType } from "@/lib/supabase/types";

const FILTERS: { label: string; value: RevivezType | "all" }[] = [
  { label: "Tout", value: "all" },
  { label: "Fails 💥", value: "fail" },
  { label: "Phrases cultes 💬", value: "phrase" },
  { label: "Coach IA 🤖", value: "roast" },
  { label: "Babyfoot 🏓", value: "babyfoot" },
  { label: "Photos 📸", value: "photo" },
];

export function RevivezClientPage({ initialPosts }: { initialPosts: RevivezPost[] }) {
  const [filter, setFilter] = useState<RevivezType | "all">("all");

  const posts = initialPosts
    .filter((p) => filter === "all" || p.type === filter)
    .sort((a, b) => b.votes_count - a.votes_count);

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="canal-headline text-2xl">Revivez</h1>
        <p className="text-canal-gray-muted text-sm mt-1">Les Archives du VAR — fails, phrases cultes, moments de gloire</p>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
        {FILTERS.map(({ label, value }) => (
          <button
            key={value}
            onClick={() => setFilter(value)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
              filter === value
                ? "bg-canal-yellow text-canal-black"
                : "bg-canal-gray-mid text-canal-gray-muted hover:text-white border border-canal-gray-light"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="space-y-4">
        {posts.map((post) => <PostCard key={post.id} post={post} />)}
        {posts.length === 0 && (
          <div className="canal-card text-center py-8">
            <p className="text-canal-gray-muted">Rien dans cette catégorie pour l'instant.</p>
            <p className="text-canal-gray-muted text-sm mt-1">La honte arrive bientôt.</p>
          </div>
        )}
      </div>
    </div>
  );
}

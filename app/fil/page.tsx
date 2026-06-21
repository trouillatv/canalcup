"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Megaphone, MessageSquareText, Send, ShieldAlert, Trophy, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FeedPost, FeedPostType } from "@/lib/supabase/types";

const TYPE_OPTIONS: { value: FeedPostType; label: string; tone: string }[] = [
  { value: "ambiance", label: "Ambiance", tone: "text-canal-yellow" },
  { value: "chambrage", label: "Chambrage", tone: "text-orange-300" },
  { value: "match", label: "Match", tone: "text-green-300" },
  { value: "babyfoot", label: "Baby-foot", tone: "text-blue-300" },
  { value: "quiz", label: "Quiz", tone: "text-purple-300" },
  { value: "animation", label: "Animation", tone: "text-pink-300" },
];

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FeedCard({ post }: { post: FeedPost }) {
  const config = TYPE_OPTIONS.find((item) => item.value === post.type);
  const author = post.display_name ?? post.email ?? "Supporter anonyme";

  return (
    <article className="canal-card border-l-2 border-l-canal-yellow/50">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-9 w-9 rounded-full bg-canal-yellow text-canal-black flex items-center justify-center font-black text-sm shrink-0">
          {author[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {post.user_id ? (
              <Link href={`/joueur/${post.user_id}`} className="font-black text-white text-sm hover:text-canal-yellow transition-colors">{author}</Link>
            ) : (
              <p className="font-black text-white text-sm">{author}</p>
            )}
            <span className={cn("text-xs font-bold", config?.tone ?? "text-canal-gray-muted")}>
              {config?.label ?? post.type}
            </span>
            <span className="text-xs text-canal-gray-muted">{formatTime(post.created_at)}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-canal-gray-light whitespace-pre-wrap">{post.body}</p>
        </div>
      </div>
    </article>
  );
}

export default function FilPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [type, setType] = useState<FeedPostType>("ambiance");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState("");

  const remaining = useMemo(() => 1200 - body.length, [body]);

  const fetchPosts = async () => {
    const res = await fetch("/api/feed", { cache: "no-store" });
    const data = await res.json();
    if (Array.isArray(data)) setPosts(data);
  };

  useEffect(() => {
    fetchPosts().finally(() => setLoading(false));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPosting(true);
    setError("");
    const res = await fetch("/api/feed", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, body }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Publication impossible.");
      setPosting(false);
      return;
    }
    setBody("");
    setType("ambiance");
    await fetchPosts();
    setPosting(false);
  };

  return (
    <div className="px-4 py-4 max-w-2xl mx-auto space-y-5">
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <Megaphone size={21} className="text-canal-yellow" />
          <h1 className="canal-headline text-2xl">Fil d'actualite</h1>
        </div>
        <p className="text-sm text-canal-gray-muted">
          Les meilleurs moments Canal Cup racontes par les participants.
        </p>
      </header>

      <form onSubmit={submit} className="canal-card space-y-3">
        <div className="flex items-center gap-2 text-white font-black text-sm">
          <MessageSquareText size={17} className="text-canal-yellow" />
          Publier dans le Fil
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {TYPE_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setType(option.value)}
              className={cn(
                "shrink-0 rounded-lg px-3 py-1.5 text-xs font-black border transition-colors",
                type === option.value
                  ? "border-canal-yellow bg-canal-yellow text-canal-black"
                  : "border-canal-gray-light bg-canal-gray-mid text-canal-gray-muted hover:text-white"
              )}
            >
              {option.label}
            </button>
          ))}
        </div>

        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Raconte le moment, chambre une equipe, annonce un baby-foot..."
          rows={4}
          maxLength={1200}
          className="w-full resize-none rounded-xl border border-canal-gray-light bg-canal-gray-mid px-4 py-3 text-sm text-white placeholder:text-canal-gray-muted focus:outline-none focus:border-canal-yellow"
          required
        />

        <div className="flex items-center justify-between gap-3">
          <p className={cn("text-xs", remaining < 80 ? "text-orange-300" : "text-canal-gray-muted")}>
            {remaining} caracteres restants
          </p>
          <button
            type="submit"
            disabled={posting || body.trim().length < 3}
            className="inline-flex items-center gap-2 rounded-xl bg-canal-yellow px-4 py-2 text-sm font-black text-canal-black disabled:opacity-50"
          >
            <Send size={15} />
            {posting ? "Publication..." : "Publier"}
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </form>

      <section className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-canal-gray-mid border border-canal-gray-light px-3 py-2">
          <Users size={15} className="text-canal-yellow mb-1" />
          <p className="text-lg font-black text-white">{posts.length}</p>
          <p className="text-[11px] text-canal-gray-muted">posts visibles</p>
        </div>
        <div className="rounded-xl bg-canal-gray-mid border border-canal-gray-light px-3 py-2">
          <Trophy size={15} className="text-canal-yellow mb-1" />
          <p className="text-lg font-black text-white">Humain</p>
          <p className="text-[11px] text-canal-gray-muted">pas auto</p>
        </div>
        <div className="rounded-xl bg-canal-gray-mid border border-canal-gray-light px-3 py-2">
          <ShieldAlert size={15} className="text-canal-yellow mb-1" />
          <p className="text-lg font-black text-white">IA</p>
          <p className="text-[11px] text-canal-gray-muted">veille admin</p>
        </div>
      </section>

      <div className="space-y-3">
        {loading && <div className="canal-card text-center py-8 text-canal-gray-muted">Chargement...</div>}
        {!loading && posts.map((post) => <FeedCard key={post.id} post={post} />)}
        {!loading && posts.length === 0 && (
          <div className="canal-card text-center py-8">
            <Megaphone size={30} className="mx-auto mb-2 text-canal-gray-muted" />
            <p className="font-bold text-white">Le Fil attend son premier moment.</p>
            <p className="text-sm text-canal-gray-muted mt-1">Un chambrage propre suffit pour lancer la journee.</p>
          </div>
        )}
      </div>
    </div>
  );
}

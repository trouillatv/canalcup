"use client";

import { useState } from "react";
import { MOCK_INBOX } from "@/lib/mock-data";
import { cn, toNCDate } from "@/lib/utils";
import type { InboxEvent } from "@/lib/supabase/types";
import { Bell, Trophy, Newspaper, Heart, MessageCircle, Star } from "lucide-react";

const TYPE_CONFIG = {
  mention: { icon: MessageCircle, color: "text-blue-400", label: "Mention" },
  vote_received: { icon: Heart, color: "text-red-400", label: "Vote reçu" },
  badge: { icon: Star, color: "text-canal-yellow", label: "Badge" },
  matinale: { icon: Newspaper, color: "text-green-400", label: "Matinale" },
  roast: { icon: Trophy, color: "text-purple-400", label: "Roast gentil" },
};

function InboxItem({ event }: { event: InboxEvent }) {
  const [read, setRead] = useState(event.is_read);
  const config = TYPE_CONFIG[event.type];
  const Icon = config.icon;

  return (
    <button
      onClick={() => setRead(true)}
      className={cn(
        "canal-card w-full text-left flex gap-3 transition-colors",
        !read && "border border-canal-yellow/20 bg-canal-gray-mid/50"
      )}
    >
      <div className={cn("mt-0.5 flex-shrink-0", config.color)}>
        <Icon size={18} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("font-bold text-sm", !read ? "text-white" : "text-canal-gray-muted")}>
            {event.title}
          </p>
          {!read && (
            <span className="w-2 h-2 bg-canal-yellow rounded-full flex-shrink-0" />
          )}
        </div>
        <p className="text-canal-gray-muted text-xs mt-0.5 leading-relaxed">{event.message}</p>
        <p className="text-canal-gray-muted text-xs mt-1">{toNCDate(event.created_at)}</p>
      </div>
    </button>
  );
}

export default function InboxPage() {
  const unread = MOCK_INBOX.filter((e) => !e.is_read).length;

  return (
    <div className="px-4 py-4 space-y-6 max-w-2xl mx-auto">
      <div>
        <div className="flex items-center gap-2">
          <Bell size={20} className="text-canal-yellow" />
          <h1 className="canal-headline text-2xl">Inbox</h1>
          {unread > 0 && (
            <span className="canal-badge">{unread} nouveau{unread > 1 ? "x" : ""}</span>
          )}
        </div>
        <p className="text-canal-gray-muted text-sm mt-1">
          Mentions, badges, roasts gentils et matinales
        </p>
      </div>

      <div className="space-y-3">
        {MOCK_INBOX.map((event) => (
          <InboxItem key={event.id} event={event} />
        ))}
        {MOCK_INBOX.length === 0 && (
          <div className="canal-card text-center py-8">
            <Bell size={32} className="text-canal-gray-muted mx-auto mb-2" />
            <p className="text-canal-gray-muted">Rien pour l'instant.</p>
            <p className="text-canal-gray-muted text-sm">Faites un pronostic ou attendez le roast du coach IA.</p>
          </div>
        )}
      </div>
    </div>
  );
}

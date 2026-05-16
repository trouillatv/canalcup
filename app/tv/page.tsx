"use client";

import { useState, useEffect } from "react";
import {
  MOCK_MATCHES, MOCK_MORNING_BRIEF, MOCK_LEADERBOARD, MOCK_REVIVEZ
} from "@/lib/mock-data";
import { flagEmoji, toNCDate, toNCTime } from "@/lib/utils";
import { QrCode } from "lucide-react";

type Slide = "classement" | "match" | "matinale" | "revivez";

const SLIDE_DURATION = 12000; // 12s par slide
const REFRESH_INTERVAL = 30000; // refresh données toutes les 30s

const SLIDES: Slide[] = ["classement", "match", "matinale", "revivez"];

function SlideClassement() {
  return (
    <div className="flex flex-col h-full justify-center px-20 py-12">
      <div className="mb-8">
        <p className="text-canal-yellow font-black text-2xl uppercase tracking-widest mb-2">
          Classement Général
        </p>
        <div className="h-1 w-32 bg-canal-yellow" />
      </div>
      <div className="space-y-6">
        {MOCK_LEADERBOARD.map((row) => (
          <div key={row.team.id} className="flex items-center gap-8">
            <span className="text-5xl w-16">
              {row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : "🥉"}
            </span>
            <div className="flex-1">
              <p className="font-black text-4xl text-white">{row.team.name}</p>
              <p className="text-canal-gray-muted text-xl italic">{row.team.slogan}</p>
            </div>
            <div className="text-right">
              <p className="font-black text-6xl text-canal-yellow">{row.total}</p>
              <p className="text-canal-gray-muted text-xl">points</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SlideMatch() {
  const match = MOCK_MATCHES.find((m) => m.status === "live")
    ?? MOCK_MATCHES.find((m) => m.status === "upcoming");
  if (!match) return null;

  return (
    <div className="flex flex-col h-full justify-center items-center px-20 py-12">
      <p className="text-canal-yellow font-black text-2xl uppercase tracking-widest mb-12">
        {match.status === "live" ? "🔴 En Direct" : "⚽ Prochain Match"}
      </p>

      <div className="flex items-center gap-16 w-full justify-center">
        {/* Equipe A */}
        <div className="flex flex-col items-center gap-4">
          <span className="text-8xl">{flagEmoji(match.flag_a ?? match.team_a)}</span>
          <p className="font-black text-4xl text-white">{match.team_a}</p>
        </div>

        {/* Score / VS */}
        <div className="flex flex-col items-center gap-2">
          {match.status !== "upcoming" ? (
            <div className="flex gap-4 items-center">
              <span className="font-black text-8xl text-canal-yellow">{match.score_a ?? 0}</span>
              <span className="font-black text-5xl text-canal-gray-muted">–</span>
              <span className="font-black text-8xl text-canal-yellow">{match.score_b ?? 0}</span>
            </div>
          ) : (
            <span className="font-black text-6xl text-canal-gray-muted">VS</span>
          )}
          <p className="text-canal-gray-muted text-xl">
            {toNCDate(match.starts_at)} — {toNCTime(match.starts_at)} NC
          </p>
          <div className="canal-badge text-lg px-4 py-1">{match.channel}</div>
        </div>

        {/* Equipe B */}
        <div className="flex flex-col items-center gap-4">
          <span className="text-8xl">{flagEmoji(match.flag_b ?? match.team_b)}</span>
          <p className="font-black text-4xl text-white">{match.team_b}</p>
        </div>
      </div>

      {match.is_match_of_week && (
        <div className="mt-12 canal-badge text-xl px-6 py-2">⭐ Match de la semaine</div>
      )}
    </div>
  );
}

function SlideMatinale() {
  const brief = MOCK_MORNING_BRIEF;
  return (
    <div className="flex flex-col h-full justify-center px-20 py-12">
      <p className="text-canal-yellow font-black text-2xl uppercase tracking-widest mb-4">
        📰 Matinale du {toNCDate(brief.date)}
      </p>
      <h2 className="font-black text-5xl text-white leading-tight mb-8">{brief.title}</h2>
      <p className="text-canal-gray-muted text-2xl leading-relaxed mb-8 max-w-4xl">{brief.body}</p>
      {brief.fail_of_day && (
        <div className="bg-red-950/30 border border-red-900/50 rounded-2xl p-6">
          <p className="text-red-400 font-bold text-xl mb-2">💥 Fail du jour</p>
          <p className="text-white text-2xl italic">"{brief.fail_of_day}"</p>
        </div>
      )}
    </div>
  );
}

function SlideRevivez() {
  const post = MOCK_REVIVEZ[Math.floor(Math.random() * MOCK_REVIVEZ.length)];
  return (
    <div className="flex flex-col h-full justify-center items-center px-20 py-12 text-center">
      <p className="text-canal-yellow font-black text-2xl uppercase tracking-widest mb-8">
        💬 Revivez — Les Archives du VAR
      </p>
      <div className="max-w-4xl">
        <p className="font-black text-3xl text-canal-gray-muted uppercase mb-6">{post.title}</p>
        <p className="text-white text-4xl leading-relaxed italic font-medium">"{post.content}"</p>
        {post.team && (
          <p className="text-canal-yellow text-xl mt-8 font-bold">— {post.team.name}</p>
        )}
        <p className="text-canal-gray-muted text-lg mt-4">❤️ {post.votes_count} votes</p>
      </div>
    </div>
  );
}

export default function TVPage() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [, setTick] = useState(0);

  // Rotation automatique des slides
  useEffect(() => {
    const t = setInterval(() => {
      setCurrentSlide((i) => (i + 1) % SLIDES.length);
    }, SLIDE_DURATION);
    return () => clearInterval(t);
  }, []);

  // Refresh données toutes les 30s (rerender pour simuler)
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), REFRESH_INTERVAL);
    return () => clearInterval(t);
  }, []);

  const slide = SLIDES[currentSlide];

  return (
    <div className="fixed inset-0 bg-canal-black flex flex-col overflow-hidden tv-mode">
      {/* Header TV */}
      <header className="flex items-center justify-between px-12 py-4 border-b border-canal-gray-light">
        <div className="flex items-center gap-4">
          <span className="text-canal-yellow font-black text-3xl tracking-tight">CANAL</span>
          <span className="text-white font-black text-3xl tracking-tight">CUP</span>
          <span className="text-canal-gray-muted text-3xl font-bold">2026</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-canal-gray-muted text-sm">Heure NC</p>
            <p className="text-white font-bold text-xl">
              {new Date().toLocaleTimeString("fr-FR", {
                timeZone: "Pacific/Noumea",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <div className="w-px h-10 bg-canal-gray-light" />
          {/* QR Code placeholder */}
          <div className="flex flex-col items-center gap-1">
            <QrCode size={40} className="text-canal-gray-muted" />
            <p className="text-xs text-canal-gray-muted">Scannez</p>
          </div>
        </div>
      </header>

      {/* Slide content */}
      <div className="flex-1 animate-fade-in" key={currentSlide}>
        {slide === "classement" && <SlideClassement />}
        {slide === "match" && <SlideMatch />}
        {slide === "matinale" && <SlideMatinale />}
        {slide === "revivez" && <SlideRevivez />}
      </div>

      {/* Indicateurs de slides */}
      <footer className="flex items-center justify-center gap-3 pb-8">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentSlide(i)}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === currentSlide ? "w-8 bg-canal-yellow" : "w-2 bg-canal-gray-light"
            }`}
          />
        ))}
      </footer>
    </div>
  );
}

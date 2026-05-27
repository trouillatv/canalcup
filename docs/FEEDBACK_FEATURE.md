# Feature « Feedback » — portable (Next.js + Supabase)

Bulle de feedback côté utilisateur + boîte de réception côté admin.
Conçue pour être copiée dans un autre projet Next.js (App Router) + Supabase.

---

## 1. Vue d'ensemble

- **Côté user** : une bulle flottante (cercle jaune, emoji **💬**) en bas à droite.
  Au clic → un panneau avec un court texte d'explication + un champ libre → envoi.
- **Côté admin** : une entrée de menu **« 💬 Feedback »** → boîte de réception
  (`/admin/feedback`) avec filtres *Nouveau / Lu / Traité* et actions
  *marquer lu / traité / supprimer*.

## 2. Icônes

| Endroit | Icône |
|---|---|
| Bulle flottante (bouton) | emoji **💬** dans un cercle |
| En-tête du panneau | lucide **`MessageSquarePlus`** |
| Entrée de menu admin (texte) | **💬 Feedback** |
| Carte dashboard admin | lucide **`MessageSquare`** |

## 3. Table SQL

```sql
create table if not exists public.feedback (
  id           uuid primary key default gen_random_uuid(), -- ou uuid_generate_v4()
  user_id      uuid references public.users(id) on delete set null,
  email        text,
  display_name text,
  message      text not null,
  page         text,                        -- chemin où le feedback a été émis
  status       text not null default 'new', -- new | read | resolved
  created_at   timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_status_idx  on public.feedback (status);
alter table public.feedback enable row level security;
-- Pas de policy : accès réservé au service_role (routes API serveur).
```

## 4. Composant bulle — `components/feedback/FloatingFeedback.tsx`

Client component. À monter dans le layout quand l'utilisateur est connecté :
`{isAuthenticated && <FloatingFeedback />}`.

```tsx
"use client";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { MessageSquarePlus, X, Send } from "lucide-react";

type Status = "idle" | "sending" | "sent" | "error";
const HIDDEN_PREFIXES = ["/tv", "/quiz-show"]; // écrans kiosque : pas de bulle

export function FloatingFeedback() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const submit = async () => {
    if (message.trim().length < 3) { setError("Écris au moins quelques mots 🙂"); return; }
    setStatus("sending"); setError("");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: message.trim(), page: pathname }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Erreur");
      setStatus("sent"); setMessage("");
      setTimeout(() => { setOpen(false); setStatus("idle"); }, 1800);
    } catch (e) {
      setStatus("error"); setError(e instanceof Error ? e.message : "Erreur réseau");
    }
  };

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-24 right-3 z-40 flex items-center justify-center w-9 h-9 rounded-full bg-yellow-400/90 text-black shadow-md hover:bg-yellow-400 transition-colors"
          aria-label="Un souci ? Envoyer un feedback"
          title="Un souci ? Envoie-nous un feedback"
        >
          <span className="text-base leading-none">💬</span>
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md bg-neutral-900 border border-neutral-700 rounded-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 p-4 border-b border-neutral-700">
              <p className="font-black text-white text-base flex items-center gap-2">
                <MessageSquarePlus size={18} className="text-yellow-400" /> Un souci ? Une idée ?
              </p>
              <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-white" aria-label="Fermer"><X size={18} /></button>
            </div>

            {status === "sent" ? (
              <div className="p-6 text-center space-y-2">
                <div className="text-4xl">🙌</div>
                <p className="text-white font-bold">Merci, c'est envoyé !</p>
              </div>
            ) : (
              <div className="p-4 space-y-3">
                <div className="bg-neutral-800 rounded-xl p-3 text-xs text-neutral-400 leading-relaxed">
                  Tu testes l'app en avant-première 🧪. Si quelque chose ne marche pas ou
                  pourrait être mieux, <span className="text-white font-bold">écris-le ici</span> :
                  ça part directement à l'équipe. Ce n'est pas un chat — on lit tout.
                </div>
                <textarea
                  value={message} onChange={(e) => setMessage(e.target.value)}
                  rows={4} maxLength={2000} autoFocus
                  placeholder="Ex : sur la page X, le bouton Valider ne fait rien sur mon iPhone…"
                  className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-yellow-400 resize-none"
                />
                {error && <p className="text-red-400 text-sm">{error}</p>}
                <button onClick={submit} disabled={status === "sending"}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-yellow-400 text-black font-black rounded-xl hover:bg-yellow-300 disabled:opacity-50">
                  {status === "sending" ? "Envoi…" : <><Send size={15} /> Envoyer à l'équipe</>}
                </button>
                <p className="text-[11px] text-neutral-400 text-center">Ton identité et la page actuelle sont jointes automatiquement.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

## 5. API d'envoi — `app/api/feedback/route.ts`

```ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";       // client session (cookies)
import { createAdminClient } from "@/lib/supabase/admin";   // client service_role

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Non authentifié" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const page = typeof body.page === "string" ? body.page.slice(0, 300) : null;
  if (message.length < 3)    return NextResponse.json({ error: "Message trop court" }, { status: 400 });
  if (message.length > 2000) return NextResponse.json({ error: "Message trop long" }, { status: 400 });

  const admin = createAdminClient();
  const { data: profile } = await admin.from("users").select("id, display_name, name").eq("auth_id", user.id).maybeSingle();
  const { error } = await admin.from("feedback").insert({
    user_id: profile?.id ?? null, email: user.email,
    display_name: profile?.display_name ?? profile?.name ?? null,
    message, page, status: "new",
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true }, { status: 201 });
}
```

## 6. API admin — `app/api/admin/feedback/route.ts` + `[id]/route.ts`

```ts
// garde commun
async function callerIsAdmin(): Promise<boolean> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const admin = createAdminClient();
  const { data } = await admin.from("allowlist_users").select("role, is_active").eq("email", user.email).single();
  return !!data?.is_active && ["admin", "super_admin"].includes(data.role);
}

// GET  /api/admin/feedback        → admin.from("feedback").select("*").order("created_at",{ascending:false})
// PATCH /api/admin/feedback/[id]  → update({ status }) où status ∈ {new,read,resolved}
// DELETE /api/admin/feedback/[id] → delete().eq("id", id)
```
> Adapte le garde admin à TON système de rôles.

## 7. Page admin — `app/admin/feedback/page.tsx`

Client component : `fetch("/api/admin/feedback")`, filtres *Tous / Nouveau / Lu /
Traité* (badge compteur sur les nouveaux), et par carte : message, pseudo, email,
page d'origine, date + boutons **Marquer lu** (`Eye`) / **Traité** (`Check`) /
**Supprimer** (`Trash2`).

## 8. Entrées de menu

**Menu admin (lien texte) :**
```tsx
{ href: "/admin/feedback", label: "💬 Feedback" }
```
**Carte dashboard admin (icône lucide) :**
```tsx
import { MessageSquare } from "lucide-react";
{ href: "/admin/feedback", label: "Feedback",
  desc: "Les retours envoyés par les testeurs via la bulle « Un souci ? ».",
  icon: MessageSquare }
```

## 9. Dépendances / à adapter

- `lucide-react`, Tailwind.
- Deux helpers Supabase : `createClient()` (session via cookies) et
  `createAdminClient()` (clé `service_role`, serveur uniquement).
- Une table `users` avec `auth_id` + un système de rôles admin
  (ici `allowlist_users.role ∈ {admin, super_admin}`).
- Couleurs : remplacées ici par des classes Tailwind standard
  (`yellow-400`, `neutral-*`) ; adapte à ta charte.
```

import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentProfile, getCurrentUserRole } from "@/lib/auth/session";
import { canAccessSupporters } from "@/lib/supporters/access";
import { SupportersClient } from "@/components/supporters/SupportersClient";

export const dynamic = "force-dynamic";

export default async function SupportersPage() {
  // BETA : page réservée aux comptes de test (Marie, Vincent) + admins le
  // temps du rodage. Voir lib/supporters/access.ts pour ouvrir au public.
  const [profile, role] = await Promise.all([getCurrentProfile(), getCurrentUserRole()]);
  if (!canAccessSupporters(role, profile?.email)) redirect("/");

  return (
    <div className="px-4 py-4 space-y-5 max-w-md mx-auto pb-24">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-canal-gray-muted"><ArrowLeft size={18} /></Link>
        <h1 className="canal-headline text-2xl flex items-center gap-2">📣 Journée Supporters</h1>
      </div>
      <p className="text-xs text-canal-gray-muted">
        Maillots, drapeaux, maquillage, déco de bureau, mise en scène… Poste la photo de
        ton binôme, fais-toi valider, et que le meilleur supporter gagne&nbsp;!
      </p>
      <Link
        href="/supporters/gallery"
        className="flex items-center justify-center gap-2 w-full text-sm font-bold px-3 py-2.5 rounded-lg bg-canal-yellow text-canal-black"
      >
        🖼️ Voir la galerie en plein écran
      </Link>
      <SupportersClient />
    </div>
  );
}

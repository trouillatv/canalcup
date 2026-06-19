import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentUserRole } from "@/lib/auth/session";
import { JokersClient } from "@/components/jokers/JokersClient";

export const dynamic = "force-dynamic";

export default async function JokersPage() {
  // Module Jokers pas encore ouvert au public : réservé aux organisateurs
  // (event_admin+) le temps du rodage. Les non-admins sont renvoyés à l'accueil.
  const role = await getCurrentUserRole();
  const isAdmin = role === "event_admin" || role === "admin" || role === "super_admin";
  if (!isAdmin) redirect("/");

  return (
    <div className="px-4 py-4 space-y-5 max-w-md mx-auto pb-24">
      <div className="flex items-center gap-3">
        <Link href="/profile" className="text-canal-gray-muted"><ArrowLeft size={18} /></Link>
        <h1 className="canal-headline text-2xl flex items-center gap-2">🃏 Mes Jokers</h1>
      </div>
      <p className="text-xs text-canal-gray-muted">
        Cartes spéciales pour pimenter les pronostics. Rares, limitées, et&nbsp;
        <span className="text-white font-bold">publiques quand elles attaquent</span>. À jouer avec
        malice — pas pour régler des comptes.
      </p>
      <JokersClient />
    </div>
  );
}

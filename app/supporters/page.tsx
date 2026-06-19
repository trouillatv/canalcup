import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SupportersClient } from "@/components/supporters/SupportersClient";

export const dynamic = "force-dynamic";

export default function SupportersPage() {
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
      <SupportersClient />
    </div>
  );
}

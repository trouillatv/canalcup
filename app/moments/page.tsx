import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth/session";
import { MomentsClient } from "@/components/moments/MomentsClient";

export const dynamic = "force-dynamic";

// Mur « Moments CanalCup » — ouvert à tout joueur connecté (binôme ou non).
export default async function MomentsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/");

  return (
    <div className="px-4 py-4 space-y-5 max-w-md mx-auto pb-24">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-canal-gray-muted"><ArrowLeft size={18} /></Link>
        <h1 className="canal-headline text-2xl flex items-center gap-2">📸 Moments CanalCup</h1>
      </div>
      <p className="text-xs text-canal-gray-muted">
        La vie de l&apos;événement, par tout le monde&nbsp;: babyfoot, quiz, déj, déguisements,
        coulisses, salon TV… Publie tes photos, réagis, commente. Pas de concours, juste les souvenirs.
      </p>
      <MomentsClient />
    </div>
  );
}

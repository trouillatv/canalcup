import { redirect } from "next/navigation";
import { getCurrentProfile, getCurrentUserRole } from "@/lib/auth/session";
import { canAccessSupporters } from "@/lib/supporters/access";
import { SupportersGallery } from "@/components/supporters/SupportersGallery";

export const dynamic = "force-dynamic";

// Galerie plein écran de la Journée Supporters (vote + réactions + commentaires).
export default async function SupportersGalleryPage() {
  const [profile, role] = await Promise.all([getCurrentProfile(), getCurrentUserRole()]);
  if (!canAccessSupporters(role, profile?.email)) redirect("/");

  return <SupportersGallery />;
}

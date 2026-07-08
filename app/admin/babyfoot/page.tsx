// La gestion du tournoi baby-foot a déménagé dans /babyfoot (onglet « Gestion »,
// réservé aux organisateurs). On redirige les anciens liens.
import { redirect } from "next/navigation";

export default function AdminBabyfootRedirect() {
  redirect("/babyfoot?tab=gestion");
}

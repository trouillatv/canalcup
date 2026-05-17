import { redirect } from "next/navigation";

// La réception magic link est désormais sur "/"
export default function LoginPage() {
  redirect("/");
}

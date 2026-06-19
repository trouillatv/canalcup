import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { JokersAdminClient } from "@/components/admin/JokersAdminClient";

export const dynamic = "force-dynamic";

// Gating admin assuré par app/admin/layout.tsx (requireRole event_admin+).
export default function AdminJokersPage() {
  return (
    <div className="px-4 py-4 space-y-5 max-w-3xl mx-auto pb-24">
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-canal-gray-muted"><ArrowLeft size={18} /></Link>
        <h1 className="canal-headline text-2xl flex items-center gap-2">🃏 Jokers</h1>
      </div>
      <JokersAdminClient />
    </div>
  );
}

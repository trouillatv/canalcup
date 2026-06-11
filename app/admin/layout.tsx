import { requireRole } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole("event_admin");
  return (
    <div>
      <div className="px-4 pt-2 pb-1 border-b border-canal-gray-light bg-canal-gray-mid/30">
        <p className="text-xs text-canal-yellow font-bold uppercase tracking-wider">Mode Admin</p>
      </div>
      {children}
    </div>
  );
}

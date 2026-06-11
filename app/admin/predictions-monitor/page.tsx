import { requireRole } from "@/lib/auth/session";
import PredictionsMonitorClient from "@/components/admin/PredictionsMonitorClient";

export const dynamic = "force-dynamic";

export default async function AdminPredictionsMonitorPage() {
  await requireRole("event_admin");
  return <PredictionsMonitorClient />;
}

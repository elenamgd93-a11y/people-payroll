import { createFileRoute } from "@tanstack/react-router";
import { withViewer } from "@/server/api";
import { listRuns } from "@/server/payroll";

export const Route = createFileRoute("/api/payroll-runs")({
  server: { handlers: { GET: ({ request }) => withViewer(request, (viewer) => listRuns(viewer)) } },
});

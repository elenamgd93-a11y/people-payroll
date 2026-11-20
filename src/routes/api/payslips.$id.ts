import { createFileRoute } from "@tanstack/react-router";
import { withViewer } from "@/server/api";
import { getPayslip } from "@/server/payroll";

export const Route = createFileRoute("/api/payslips/$id")({
  server: {
    handlers: { GET: ({ request, params }) => withViewer(request, (viewer) => getPayslip(viewer, params.id)) },
  },
});

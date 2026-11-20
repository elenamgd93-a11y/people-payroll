import { createFileRoute } from "@tanstack/react-router";
import { withViewer } from "@/server/api";
import { getEmployee } from "@/server/employees";

export const Route = createFileRoute("/api/employees/$id")({
  server: {
    handlers: { GET: ({ request, params }) => withViewer(request, (viewer) => getEmployee(viewer, params.id)) },
  },
});

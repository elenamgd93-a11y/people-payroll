import { createFileRoute } from "@tanstack/react-router";
import { withViewer } from "@/server/api";
import { getEmployee } from "@/server/employees";

export const Route = createFileRoute("/api/me")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withViewer(request, async (viewer) => ({
          email: viewer.email,
          isAdmin: viewer.admin,
          employee: viewer.employee ? await getEmployee(viewer, viewer.employee.id) : null,
        })),
    },
  },
});

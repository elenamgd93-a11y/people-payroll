import { createFileRoute } from "@tanstack/react-router";
import { withViewer } from "@/server/api";
import { allVisible } from "@/server/employees";

export const Route = createFileRoute("/api/employees")({
  server: { handlers: { GET: ({ request }) => withViewer(request, (viewer) => allVisible(viewer)) } },
});

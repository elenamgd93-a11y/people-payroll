import { createFileRoute } from "@tanstack/react-router";
import { withViewer } from "@/server/api";
import { checkIn } from "@/server/attendance";

export const Route = createFileRoute("/api/attendance/check-in")({
  server: { handlers: { POST: ({ request }) => withViewer(request, (viewer) => checkIn(viewer)) } },
});

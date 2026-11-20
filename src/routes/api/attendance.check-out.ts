import { createFileRoute } from "@tanstack/react-router";
import { withViewer } from "@/server/api";
import { checkOut } from "@/server/attendance";

export const Route = createFileRoute("/api/attendance/check-out")({
  server: { handlers: { POST: ({ request }) => withViewer(request, (viewer) => checkOut(viewer)) } },
});

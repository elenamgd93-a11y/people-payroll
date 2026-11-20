import { createFileRoute } from "@tanstack/react-router";
import { withViewer } from "@/server/api";
import { myAttendance } from "@/server/attendance";

export const Route = createFileRoute("/api/attendance")({
  server: {
    handlers: {
      GET: ({ request }) =>
        withViewer(request, (viewer) => {
          const month = new URL(request.url).searchParams.get("month");
          return myAttendance(viewer, month && /^\d{4}-\d{2}$/.test(month) ? month : undefined);
        }),
    },
  },
});

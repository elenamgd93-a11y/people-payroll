import { createFileRoute } from "@tanstack/react-router";
import { withViewer } from "@/server/api";
import { decideLeave, decisionInput } from "@/server/leave";

export const Route = createFileRoute("/api/leave-requests/$id/decision")({
  server: {
    handlers: {
      POST: ({ request, params }) =>
        withViewer(request, async (viewer) => {
          const { decision } = decisionInput.parse(await request.json());
          return decideLeave(viewer, params.id, decision);
        }),
    },
  },
});

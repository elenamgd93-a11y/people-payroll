import { createFileRoute } from "@tanstack/react-router";
import { withViewer } from "@/server/api";
import { documentFile } from "@/server/documents";

export const Route = createFileRoute("/api/documents/$id/file")({
  server: {
    handlers: { GET: ({ request, params }) => withViewer(request, (viewer) => documentFile(viewer, params.id)) },
  },
});

import { createFileRoute } from "@tanstack/react-router";
import { withViewer } from "@/server/api";
import { uploadDocument } from "@/server/documents";

// Uploads are multipart, so they come here rather than through a server function.
export const Route = createFileRoute("/api/documents")({
  server: {
    handlers: {
      POST: ({ request }) =>
        withViewer(request, async (viewer) => uploadDocument(viewer, await request.formData())),
    },
  },
});

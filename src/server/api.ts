import { getEveryAppUser } from "@every-app/sdk/server";
import { env } from "cloudflare:workers";
import { AppError, errorResponse } from "@/server/errors";
import { getViewer, type Viewer } from "@/server/viewer";

/**
 * A JSON route for members and personal access tokens: the same queries as
 * the pages, with the member the Gateway signed in.
 */
export async function withViewer(
  request: Request,
  handle: (viewer: Viewer) => Promise<unknown>,
): Promise<Response> {
  try {
    const user = await getEveryAppUser(request, env);
    if (!user) throw new AppError(403, "Sign in through the Gateway");
    const result = await handle(await getViewer(user));
    return result instanceof Response ? result : Response.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}

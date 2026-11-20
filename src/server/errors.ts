/** An error a person may read, with the HTTP status a server route answers. */
export class AppError extends Error {
  constructor(
    readonly status: 400 | 403 | 404 | 409,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = () => new AppError(404, "Not found");
export const forbidden = () => new AppError(403, "Only an admin can do this");

/** A server route's answer for an error: AppErrors keep their status. */
export function errorResponse(error: unknown): Response {
  if (error instanceof AppError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  if (error && typeof error === "object" && "issues" in error) {
    return Response.json({ error: "Invalid input" }, { status: 400 });
  }
  throw error;
}

import { env } from "cloudflare:workers";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { documents, employees } from "@/db/schema";
import { AppError, notFound } from "@/server/errors";
import { localDate } from "@/server/time";
import { requireAdmin, type Viewer } from "@/server/viewer";

export const DOCUMENT_TYPES = [
  "passport",
  "visa",
  "id",
  "contract",
  "trade_licence",
  "other",
] as const;
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
/** Days ahead that count as expiring soon. */
export const EXPIRY_WINDOW_DAYS = 30;

const bucket = () => (env as unknown as { files: R2Bucket }).files;

const uploadFields = z.object({
  employeeId: z.string().nullable(),
  type: z.enum(DOCUMENT_TYPES),
  number: z.string().trim().max(80),
  expiresOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

export function expiryState(expiresOn: string | null, today = localDate()) {
  if (!expiresOn) return "none" as const;
  if (expiresOn < today) return "expired" as const;
  const soon = new Date(Date.parse(today) + EXPIRY_WINDOW_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return expiresOn <= soon ? ("soon" as const) : ("valid" as const);
}

/** Admins see every document; anyone else only those filed on their own record. */
function visibleTo(viewer: Viewer) {
  if (viewer.admin) return undefined;
  if (!viewer.employee) return sql`0`;
  return eq(documents.employeeId, viewer.employee.id);
}

export async function listDocuments(viewer: Viewer, employeeId?: string) {
  const today = localDate();
  const rows = await db
    .select({
      id: documents.id,
      employeeId: documents.employeeId,
      employeeName: employees.fullName,
      type: documents.type,
      number: documents.number,
      expiresOn: documents.expiresOn,
      fileName: documents.fileName,
      size: documents.size,
      createdAt: documents.createdAt,
    })
    .from(documents)
    .leftJoin(employees, eq(employees.id, documents.employeeId))
    .where(
      and(
        visibleTo(viewer),
        employeeId === undefined
          ? undefined
          : employeeId === "company"
            ? isNull(documents.employeeId)
            : eq(documents.employeeId, employeeId),
      ),
    )
    .orderBy(sql`${documents.expiresOn} is null`, asc(documents.expiresOn), desc(documents.createdAt));
  return rows.map((row) => ({ ...row, expiry: expiryState(row.expiresOn, today) }));
}

export async function uploadDocument(viewer: Viewer, form: FormData) {
  requireAdmin(viewer);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new AppError(400, "Choose a file");
  }
  if (file.size > MAX_FILE_BYTES) throw new AppError(400, "Files can be up to 10 MB");
  const owner = String(form.get("employeeId") ?? "");
  const fields = uploadFields.safeParse({
    employeeId: owner && owner !== "company" ? owner : null,
    type: form.get("type"),
    number: String(form.get("number") ?? ""),
    expiresOn: String(form.get("expiresOn") ?? "") || null,
  });
  if (!fields.success) throw new AppError(400, "Check the document's details");
  const values = fields.data;
  if (values.employeeId) {
    const [employee] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(eq(employees.id, values.employeeId));
    if (!employee) throw new AppError(400, "That employee doesn't exist");
  }
  const id = crypto.randomUUID();
  const fileKey = `documents/${id}`;
  const contentType = file.type || "application/octet-stream";
  await bucket().put(fileKey, file.stream(), { httpMetadata: { contentType } });
  await db.insert(documents).values({
    id,
    ...values,
    fileName: file.name.slice(0, 200) || "document",
    contentType,
    size: file.size,
    fileKey,
    uploadedBy: viewer.userId,
  });
  return { id };
}

/** The file, after the same check as its record. */
export async function documentFile(viewer: Viewer, id: string): Promise<Response> {
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), visibleTo(viewer)));
  if (!doc) throw notFound();
  const object = await bucket().get(doc.fileKey);
  if (!object) throw notFound();
  const name = doc.fileName.replace(/["\\\r\n]/g, "_");
  return new Response(object.body, {
    headers: {
      "content-type": doc.contentType,
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function deleteDocument(viewer: Viewer, id: string) {
  requireAdmin(viewer);
  const [doc] = await db.delete(documents).where(eq(documents.id, id)).returning();
  if (!doc) throw notFound();
  await bucket().delete(doc.fileKey);
  return { id };
}

import { isAdmin, type EveryAppUser } from "@every-app/sdk/server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { employees, users } from "@/db/schema";
import { AppError } from "@/server/errors";

export type Employee = typeof employees.$inferSelect;

export interface Viewer {
  userId: string;
  email: string;
  admin: boolean;
  /** The employee record linked to this member, if any. */
  employee: Employee | null;
}

/**
 * The signed-in member as the app knows them: their user row (created on
 * first sight) and the employee record with their work email, linked to
 * their user id the first time they are seen.
 */
export async function getViewer(
  user: Pick<EveryAppUser, "id" | "email" | "orgRole">,
): Promise<Viewer> {
  const email = user.email.trim().toLowerCase();
  await db
    .insert(users)
    .values({ id: user.id, email })
    .onConflictDoUpdate({ target: users.id, set: { email } });
  let [employee] = await db
    .select()
    .from(employees)
    .where(eq(employees.userId, user.id))
    .limit(1);
  if (!employee) {
    [employee] = await db
      .update(employees)
      .set({ userId: user.id })
      .where(
        and(
          sql`lower(${employees.email}) = ${email}`,
          isNull(employees.userId),
        ),
      )
      .returning();
  }
  return {
    userId: user.id,
    email,
    admin: isAdmin(user),
    employee: employee ?? null,
  };
}

export function requireAdmin(viewer: Viewer): void {
  if (!viewer.admin) throw new AppError(403, "Only an admin can do this");
}

export function requireEmployee(viewer: Viewer): Employee {
  if (!viewer.employee) {
    throw new AppError(
      409,
      "No employee record has your email yet. Ask an admin to add you.",
    );
  }
  return viewer.employee;
}

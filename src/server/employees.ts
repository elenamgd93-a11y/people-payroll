import { and, asc, desc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import type { z } from "zod";
import { employeeInput, listInput } from "@/shared/inputs";
export { employeeInput, listInput };
import { db } from "@/db";
import { employees } from "@/db/schema";
import { AppError, notFound } from "@/server/errors";
import { requireAdmin, type Employee, type Viewer } from "@/server/viewer";




export const PAGE_SIZE = 20;

/** An employee as a viewer may see them: salary only for admins. */
export function shown(employee: Employee, viewer: Viewer, managerName?: string | null) {
  const base = {
    id: employee.id,
    fullName: employee.fullName,
    email: employee.email,
    jobTitle: employee.jobTitle,
    department: employee.department,
    managerId: employee.managerId,
    managerName: managerName ?? null,
    hireDate: employee.hireDate,
    status: employee.status,
  };
  if (!viewer.admin) return base;
  return { ...base, baseSalary: employee.baseSalary, allowances: employee.allowances };
}
export type ShownEmployee = ReturnType<typeof shown> & {
  baseSalary?: number;
  allowances?: number;
};

/** Which employees a viewer may read: everyone for admins, else self and direct reports. */
export function visibleTo(viewer: Viewer): SQL | undefined {
  if (viewer.admin) return undefined;
  if (!viewer.employee) return sql`0`;
  return or(
    eq(employees.id, viewer.employee.id),
    eq(employees.managerId, viewer.employee.id),
  );
}

export async function listEmployees(viewer: Viewer, input: z.infer<typeof listInput>) {
  const filters: (SQL | undefined)[] = [visibleTo(viewer)];
  const status = input.status ?? "active";
  if (status !== "all") filters.push(eq(employees.status, status));
  if (input.department) filters.push(eq(employees.department, input.department));
  if (input.q?.trim()) {
    const term = `%${input.q.trim().toLowerCase()}%`;
    filters.push(
      or(
        like(sql`lower(${employees.fullName})`, term),
        like(sql`lower(${employees.email})`, term),
        like(sql`lower(${employees.jobTitle})`, term),
      ),
    );
  }
  const column = {
    name: employees.fullName,
    department: employees.department,
    hireDate: employees.hireDate,
    jobTitle: employees.jobTitle,
  }[input.sort ?? "name"];
  const order = input.dir === "desc" ? desc(column) : asc(column);
  const where = and(...filters);
  const page = input.page ?? 1;
  const [rows, [{ total }], departments, names] = await Promise.all([
    db
      .select()
      .from(employees)
      .where(where)
      .orderBy(order, asc(employees.id))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: sql<number>`count(*)` }).from(employees).where(where),
    db
      .selectDistinct({ department: employees.department })
      .from(employees)
      .where(visibleTo(viewer))
      .orderBy(employees.department),
    db.select({ id: employees.id, fullName: employees.fullName }).from(employees),
  ]);
  const nameOf = new Map(names.map((n) => [n.id, n.fullName]));
  return {
    rows: rows.map((e) => shown(e, viewer, e.managerId ? nameOf.get(e.managerId) : null)),
    total,
    page,
    pageSize: PAGE_SIZE,
    departments: departments.map((d) => d.department).filter(Boolean),
  };
}

/** Every employee a viewer may read, for the JSON API. */
export async function allVisible(viewer: Viewer) {
  const rows = await db
    .select()
    .from(employees)
    .where(visibleTo(viewer))
    .orderBy(asc(employees.fullName));
  return rows.map((e) => shown(e, viewer));
}

export async function getEmployee(viewer: Viewer, id: string) {
  const [employee] = await db
    .select()
    .from(employees)
    .where(and(eq(employees.id, id), visibleTo(viewer)))
    .limit(1);
  if (!employee) throw notFound();
  let managerName: string | null = null;
  if (employee.managerId) {
    const [manager] = await db
      .select({ fullName: employees.fullName })
      .from(employees)
      .where(eq(employees.id, employee.managerId));
    managerName = manager?.fullName ?? null;
  }
  return shown(employee, viewer, managerName);
}

/** Active employees for pickers (admins only). */
export async function employeeOptions(viewer: Viewer) {
  requireAdmin(viewer);
  return db
    .select({ id: employees.id, fullName: employees.fullName, status: employees.status })
    .from(employees)
    .orderBy(asc(employees.fullName));
}

async function wouldCycle(id: string, managerId: string): Promise<boolean> {
  let current: string | null = managerId;
  for (let i = 0; current && i < 50; i++) {
    if (current === id) return true;
    const [row] = await db
      .select({ managerId: employees.managerId })
      .from(employees)
      .where(eq(employees.id, current));
    current = row?.managerId ?? null;
  }
  return false;
}

export async function saveEmployee(viewer: Viewer, input: z.infer<typeof employeeInput>) {
  requireAdmin(viewer);
  const { id, ...values } = input;
  if (values.managerId) {
    const [manager] = await db
      .select({ id: employees.id })
      .from(employees)
      .where(inArray(employees.id, [values.managerId]));
    if (!manager) throw new AppError(400, "That manager doesn't exist");
    if (id && (await wouldCycle(id, values.managerId))) {
      throw new AppError(400, "An employee can't report to themselves or their own reports");
    }
  }
  const [clash] = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.email, values.email));
  if (clash && clash.id !== id) {
    throw new AppError(409, "Another employee already has this email");
  }
  if (id) {
    const [row] = await db
      .update(employees)
      .set({ ...values })
      .where(eq(employees.id, id))
      .returning();
    if (!row) throw notFound();
    // A changed email links again on that person's next visit.
    if (row.userId && clash?.id !== id) {
      await db.update(employees).set({ userId: null }).where(eq(employees.id, id));
    }
    return { id: row.id };
  }
  const [row] = await db
    .insert(employees)
    .values({ id: crypto.randomUUID(), ...values })
    .returning({ id: employees.id });
  return row!;
}

export async function setStatus(viewer: Viewer, id: string, status: "active" | "archived") {
  requireAdmin(viewer);
  const [row] = await db
    .update(employees)
    .set({ status })
    .where(eq(employees.id, id))
    .returning({ id: employees.id });
  if (!row) throw notFound();
  return row;
}

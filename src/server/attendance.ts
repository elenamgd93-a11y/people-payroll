import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, lte, ne } from "drizzle-orm";
import type { z } from "zod";
import { monthInput, correctionInput } from "@/shared/inputs";
export { monthInput, correctionInput };
import { db } from "@/db";
import { attendance, attendanceCorrections, employees } from "@/db/schema";
import { AppError, notFound } from "@/server/errors";
import { WORKDAY_START, hoursBetween, localDate, localTime, toInstant } from "@/server/time";
import { requireEmployee, type Viewer } from "@/server/viewer";




type Row = typeof attendance.$inferSelect;

function present(row: Row) {
  const checkIn = row.checkInAt ? localTime(row.checkInAt) : null;
  return {
    id: row.id,
    date: row.date,
    checkInAt: row.checkInAt,
    checkOutAt: row.checkOutAt,
    checkIn,
    checkOut: row.checkOutAt ? localTime(row.checkOutAt) : null,
    hours: hoursBetween(row.checkInAt, row.checkOutAt),
    late: !!checkIn && checkIn > WORKDAY_START,
  };
}

function monthRange(month?: string) {
  const m = month ?? localDate().slice(0, 7);
  return { month: m, from: `${m}-01`, to: `${m}-31` };
}

export async function myAttendance(viewer: Viewer, month?: string) {
  const range = monthRange(month);
  const today = localDate();
  const employee = viewer.employee;
  if (!employee) return { ...range, today, todayRecord: null, records: [], corrections: [], linked: false };
  const rows = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.employeeId, employee.id), gte(attendance.date, range.from), lte(attendance.date, range.to)))
    .orderBy(desc(attendance.date));
  const [todayRow] = await db
    .select()
    .from(attendance)
    .where(and(eq(attendance.employeeId, employee.id), eq(attendance.date, today)));
  const corrections = await db
    .select()
    .from(attendanceCorrections)
    .where(eq(attendanceCorrections.employeeId, employee.id))
    .orderBy(desc(attendanceCorrections.createdAt))
    .limit(20);
  return {
    ...range,
    today,
    todayRecord: todayRow ? present(todayRow) : null,
    records: rows.map(present),
    corrections,
    linked: true,
  };
}

/** The server's clock, never the browser's. Once per day. */
export async function checkIn(viewer: Viewer) {
  const employee = requireEmployee(viewer);
  if (employee.status !== "active") throw new AppError(409, "Archived employees can't check in");
  const [row] = await db
    .insert(attendance)
    .values({ id: crypto.randomUUID(), employeeId: employee.id, date: localDate(), checkInAt: new Date().toISOString() })
    .onConflictDoNothing()
    .returning();
  if (!row) throw new AppError(409, "You already checked in today");
  return present(row);
}

export async function checkOut(viewer: Viewer) {
  const employee = requireEmployee(viewer);
  const [row] = await db
    .update(attendance)
    .set({ checkOutAt: new Date().toISOString() })
    .where(
      and(
        eq(attendance.employeeId, employee.id),
        eq(attendance.date, localDate()),
        isNotNull(attendance.checkInAt),
        isNull(attendance.checkOutAt),
      ),
    )
    .returning();
  if (!row) throw new AppError(409, "Check in first, once a day");
  return present(row);
}

export async function requestCorrection(viewer: Viewer, input: z.infer<typeof correctionInput>) {
  const employee = requireEmployee(viewer);
  if (input.date > localDate()) throw new AppError(400, "That day hasn't happened yet");
  if (input.checkOut && input.checkOut <= input.checkIn) {
    throw new AppError(400, "Check-out must be after check-in");
  }
  const [row] = await db
    .insert(attendanceCorrections)
    .values({ id: crypto.randomUUID(), employeeId: employee.id, ...input })
    .returning();
  return row!;
}

/** Ids of the employees whose attendance the viewer manages, or "all". */
async function managedIds(viewer: Viewer): Promise<string[] | "all"> {
  if (viewer.admin) return "all";
  if (!viewer.employee) return [];
  const rows = await db
    .select({ id: employees.id })
    .from(employees)
    .where(eq(employees.managerId, viewer.employee.id));
  return rows.map((r) => r.id);
}

export async function pendingCorrections(viewer: Viewer) {
  const ids = await managedIds(viewer);
  if (ids !== "all" && ids.length === 0) return [];
  const self = viewer.employee?.id ?? "";
  return db
    .select({
      id: attendanceCorrections.id,
      employeeName: employees.fullName,
      date: attendanceCorrections.date,
      checkIn: attendanceCorrections.checkIn,
      checkOut: attendanceCorrections.checkOut,
      reason: attendanceCorrections.reason,
    })
    .from(attendanceCorrections)
    .innerJoin(employees, eq(employees.id, attendanceCorrections.employeeId))
    .where(
      and(
        eq(attendanceCorrections.status, "pending"),
        ne(attendanceCorrections.employeeId, self),
        ids === "all" ? undefined : inArray(attendanceCorrections.employeeId, ids),
      ),
    )
    .orderBy(asc(attendanceCorrections.date));
}

export async function decideCorrection(viewer: Viewer, id: string, decision: "approved" | "rejected") {
  const [correction] = await db
    .select({ c: attendanceCorrections, managerId: employees.managerId })
    .from(attendanceCorrections)
    .innerJoin(employees, eq(employees.id, attendanceCorrections.employeeId))
    .where(eq(attendanceCorrections.id, id));
  if (!correction) throw notFound();
  const self = viewer.employee?.id;
  const isManager = !!self && correction.managerId === self;
  if (correction.c.employeeId === self || (!viewer.admin && !isManager)) {
    throw new AppError(403, "Only the employee's manager or an admin can decide this");
  }
  const [decided] = await db
    .update(attendanceCorrections)
    .set({ status: decision, decidedBy: viewer.userId })
    .where(and(eq(attendanceCorrections.id, id), eq(attendanceCorrections.status, "pending")))
    .returning();
  if (!decided) throw new AppError(409, "This correction was already decided");
  if (decision === "approved") {
    const checkInAt = toInstant(decided.date, decided.checkIn);
    const checkOutAt = decided.checkOut ? toInstant(decided.date, decided.checkOut) : null;
    await db
      .insert(attendance)
      .values({ id: crypto.randomUUID(), employeeId: decided.employeeId, date: decided.date, checkInAt, checkOutAt })
      .onConflictDoUpdate({ target: [attendance.employeeId, attendance.date], set: { checkInAt, checkOutAt } });
  }
  return decided;
}

/** Totals per employee for a month: the viewer's reports, or everyone for admins. */
export async function teamAttendance(viewer: Viewer, month?: string) {
  const range = monthRange(month);
  const ids = await managedIds(viewer);
  if (ids !== "all" && ids.length === 0) return { ...range, rows: [], allowed: false };
  const people = await db
    .select({ id: employees.id, fullName: employees.fullName, department: employees.department })
    .from(employees)
    .where(and(eq(employees.status, "active"), ids === "all" ? undefined : inArray(employees.id, ids)))
    .orderBy(asc(employees.fullName));
  const records = people.length
    ? await db
        .select()
        .from(attendance)
        .where(
          and(
            inArray(attendance.employeeId, people.map((p) => p.id)),
            gte(attendance.date, range.from),
            lte(attendance.date, range.to),
          ),
        )
    : [];
  const rows = people.map((person) => {
    const mine = records.filter((r) => r.employeeId === person.id && r.checkInAt).map(present);
    return {
      ...person,
      daysPresent: mine.length,
      lateDays: mine.filter((r) => r.late).length,
      hours: Math.round(mine.reduce((sum, r) => sum + r.hours, 0) * 10) / 10,
    };
  });
  return { ...range, rows, allowed: true };
}

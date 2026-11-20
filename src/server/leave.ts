import { and, asc, desc, eq, gte, inArray, lte, ne, or, sql } from "drizzle-orm";
import type { z } from "zod";
import { leaveTypeInput, leaveRequestInput, decisionInput } from "@/shared/inputs";
export { leaveTypeInput, leaveRequestInput, decisionInput };
import { db } from "@/db";
import { employees, leaveRequests, leaveTypes } from "@/db/schema";
import { AppError, notFound } from "@/server/errors";
import { daysBetween, localDate } from "@/server/time";
import { requireAdmin, requireEmployee, type Viewer } from "@/server/viewer";





export function listLeaveTypes() {
  return db.select().from(leaveTypes).orderBy(asc(leaveTypes.name));
}

export async function createLeaveType(viewer: Viewer, input: z.infer<typeof leaveTypeInput>) {
  requireAdmin(viewer);
  const [row] = await db
    .insert(leaveTypes)
    .values({ id: crypto.randomUUID(), ...input })
    .returning();
  return row!;
}

export async function updateLeaveType(
  viewer: Viewer,
  id: string,
  input: z.infer<typeof leaveTypeInput>,
) {
  requireAdmin(viewer);
  const [row] = await db.update(leaveTypes).set(input).where(eq(leaveTypes.id, id)).returning();
  if (!row) throw notFound();
  return row;
}

/** Days of a type an employee used in a year, by status. */
async function usedDays(employeeId: string, typeId: string, year: number, statuses: ("approved" | "pending")[]) {
  const [row] = await db
    .select({ days: sql<number>`coalesce(sum(${leaveRequests.days}), 0)` })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.employeeId, employeeId),
        eq(leaveRequests.typeId, typeId),
        inArray(leaveRequests.status, statuses),
        gte(leaveRequests.startDate, `${year}-01-01`),
        lte(leaveRequests.startDate, `${year}-12-31`),
      ),
    );
  return Number(row?.days ?? 0);
}

type LeaveType = typeof leaveTypes.$inferSelect;
type EmployeeRow = typeof employees.$inferSelect;

/** Allowance plus carryover minus approved days, for one year. */
async function balanceFor(employee: EmployeeRow, type: LeaveType, year: number) {
  const taken = await usedDays(employee.id, type.id, year, ["approved"]);
  const pending = await usedDays(employee.id, type.id, year, ["pending"]);
  if (type.allowanceDays === null) {
    return { allowance: null, carryover: 0, taken, pending, remaining: null };
  }
  let carryover = 0;
  if (type.carryoverCap > 0 && employee.hireDate < `${year}-01-01`) {
    const lastYear = await usedDays(employee.id, type.id, year - 1, ["approved"]);
    carryover = Math.min(type.carryoverCap, Math.max(0, type.allowanceDays - lastYear));
  }
  return {
    allowance: type.allowanceDays,
    carryover,
    taken,
    pending,
    remaining: type.allowanceDays + carryover - taken,
  };
}

export async function myLeave(viewer: Viewer) {
  const types = await listLeaveTypes();
  const employee = viewer.employee;
  if (!employee) return { types, balances: [], requests: [] };
  const year = Number(localDate().slice(0, 4));
  const balances = await Promise.all(
    types.map(async (type) => ({ type, ...(await balanceFor(employee, type, year)) })),
  );
  const requests = await db
    .select({
      id: leaveRequests.id,
      typeName: leaveTypes.name,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      days: leaveRequests.days,
      reason: leaveRequests.reason,
      status: leaveRequests.status,
      createdAt: leaveRequests.createdAt,
    })
    .from(leaveRequests)
    .leftJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.typeId))
    .where(eq(leaveRequests.employeeId, employee.id))
    .orderBy(desc(leaveRequests.startDate), desc(leaveRequests.createdAt));
  return { types, balances, requests };
}

export async function requestLeave(viewer: Viewer, input: z.infer<typeof leaveRequestInput>) {
  const employee = requireEmployee(viewer);
  if (employee.status !== "active") throw new AppError(409, "Archived employees can't request leave");
  if (input.endDate < input.startDate) throw new AppError(400, "The end date is before the start date");
  if (input.startDate.slice(0, 4) !== input.endDate.slice(0, 4)) {
    throw new AppError(400, "A request can't span two years. Split it in two.");
  }
  const [type] = await db.select().from(leaveTypes).where(eq(leaveTypes.id, input.typeId));
  if (!type) throw new AppError(400, "Pick a leave type");
  const days = daysBetween(input.startDate, input.endDate);
  const [overlap] = await db
    .select({ id: leaveRequests.id })
    .from(leaveRequests)
    .where(
      and(
        eq(leaveRequests.employeeId, employee.id),
        inArray(leaveRequests.status, ["pending", "approved"]),
        lte(leaveRequests.startDate, input.endDate),
        gte(leaveRequests.endDate, input.startDate),
      ),
    )
    .limit(1);
  if (overlap) throw new AppError(409, "This request overlaps leave you already have");
  const balance = await balanceFor(employee, type, Number(input.startDate.slice(0, 4)));
  if (balance.remaining !== null) {
    const available = balance.remaining - balance.pending;
    if (days > available) {
      throw new AppError(
        409,
        `Not enough balance: ${available} ${available === 1 ? "day" : "days"} left, ${days} asked`,
      );
    }
  }
  const [row] = await db
    .insert(leaveRequests)
    .values({ id: crypto.randomUUID(), employeeId: employee.id, ...input, days })
    .returning();
  return row!;
}

export async function cancelLeave(viewer: Viewer, id: string) {
  const employee = requireEmployee(viewer);
  const [row] = await db
    .update(leaveRequests)
    .set({ status: "cancelled" })
    .where(
      and(
        eq(leaveRequests.id, id),
        eq(leaveRequests.employeeId, employee.id),
        eq(leaveRequests.status, "pending"),
      ),
    )
    .returning();
  if (!row) throw new AppError(409, "Only your own pending requests can be cancelled");
  return row;
}

/** Pending requests the viewer may decide, each with the team's overlapping leave. */
export async function approvals(viewer: Viewer) {
  if (!viewer.admin && !viewer.employee) return [];
  const self = viewer.employee?.id ?? "";
  const scope = viewer.admin
    ? ne(leaveRequests.employeeId, self)
    : eq(employees.managerId, self);
  const pending = await db
    .select({
      id: leaveRequests.id,
      employeeId: leaveRequests.employeeId,
      employeeName: employees.fullName,
      managerId: employees.managerId,
      typeName: leaveTypes.name,
      startDate: leaveRequests.startDate,
      endDate: leaveRequests.endDate,
      days: leaveRequests.days,
      reason: leaveRequests.reason,
    })
    .from(leaveRequests)
    .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
    .leftJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.typeId))
    .where(and(eq(leaveRequests.status, "pending"), scope))
    .orderBy(asc(leaveRequests.startDate));
  return Promise.all(
    pending.map(async (request) => {
      const overlapping = request.managerId
        ? await db
            .select({
              employeeName: employees.fullName,
              startDate: leaveRequests.startDate,
              endDate: leaveRequests.endDate,
              status: leaveRequests.status,
            })
            .from(leaveRequests)
            .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
            .where(
              and(
                or(
                  eq(employees.managerId, request.managerId),
                  eq(employees.id, request.managerId),
                ),
                ne(leaveRequests.employeeId, request.employeeId),
                inArray(leaveRequests.status, ["pending", "approved"]),
                lte(leaveRequests.startDate, request.endDate),
                gte(leaveRequests.endDate, request.startDate),
              ),
            )
        : [];
      return { ...request, overlapping };
    }),
  );
}

/** Decide once: only an admin or the direct manager, never the requester. */
export async function decideLeave(
  viewer: Viewer,
  id: string,
  decision: "approved" | "rejected",
) {
  const [request] = await db
    .select({ employeeId: leaveRequests.employeeId, managerId: employees.managerId, status: leaveRequests.status })
    .from(leaveRequests)
    .innerJoin(employees, eq(employees.id, leaveRequests.employeeId))
    .where(eq(leaveRequests.id, id));
  if (!request) throw notFound();
  const self = viewer.employee?.id;
  const isManager = !!self && request.managerId === self;
  if (request.employeeId === self || (!viewer.admin && !isManager)) {
    throw new AppError(403, "Only the employee's manager or an admin can decide this");
  }
  const [row] = await db
    .update(leaveRequests)
    .set({ status: decision, decidedBy: viewer.userId, decidedAt: new Date().toISOString() })
    .where(and(eq(leaveRequests.id, id), eq(leaveRequests.status, "pending")))
    .returning();
  if (!row) throw new AppError(409, "This request was already decided");
  return row;
}

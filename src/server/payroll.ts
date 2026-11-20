import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import type { z } from "zod";
import { periodInput, adjustInput } from "@/shared/inputs";
export { periodInput, adjustInput };
import { db } from "@/db";
import { employees, leaveRequests, leaveTypes, payrollLines, payrollRuns } from "@/db/schema";
import { AppError, notFound } from "@/server/errors";
import { requireAdmin, type Viewer } from "@/server/viewer";



/** Days in a month count as 30 for the unpaid-leave deduction. */
export const DAYS_PER_MONTH = 30;

const round = (n: number) => Math.round(n * 100) / 100;

export function netPay(line: {
  baseSalary: number;
  allowances: number;
  unpaidDeduction: number;
  additions: number;
  deductions: number;
}) {
  return round(line.baseSalary + line.allowances - line.unpaidDeduction + line.additions - line.deductions);
}

function lastDay(period: string) {
  const [y, m] = period.split("-").map(Number);
  return `${period}-${String(new Date(Date.UTC(y!, m!, 0)).getUTCDate()).padStart(2, "0")}`;
}

function overlapDays(start: string, end: string, from: string, to: string) {
  const a = start > from ? start : from;
  const b = end < to ? end : to;
  if (b < a) return 0;
  return Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) + 1;
}

export async function listRuns(viewer: Viewer) {
  requireAdmin(viewer);
  return db.select().from(payrollRuns).orderBy(desc(payrollRuns.period));
}

export async function createRun(viewer: Viewer, period: string) {
  requireAdmin(viewer);
  const [existing] = await db.select({ id: payrollRuns.id }).from(payrollRuns).where(eq(payrollRuns.period, period));
  if (existing) throw new AppError(409, "There's already a run for this month");
  const from = `${period}-01`;
  const to = lastDay(period);
  const people = await db.select().from(employees).where(eq(employees.status, "active"));
  const unpaid = await db
    .select({ employeeId: leaveRequests.employeeId, startDate: leaveRequests.startDate, endDate: leaveRequests.endDate })
    .from(leaveRequests)
    .innerJoin(leaveTypes, eq(leaveTypes.id, leaveRequests.typeId))
    .where(
      and(
        eq(leaveRequests.status, "approved"),
        eq(leaveTypes.paid, false),
        lte(leaveRequests.startDate, to),
        gte(leaveRequests.endDate, from),
      ),
    );
  const id = crypto.randomUUID();
  const lines = people.map((person) => {
    const unpaidDays = unpaid
      .filter((l) => l.employeeId === person.id)
      .reduce((sum, l) => sum + overlapDays(l.startDate, l.endDate, from, to), 0);
    const unpaidDeduction = round((person.baseSalary / DAYS_PER_MONTH) * unpaidDays);
    const line = {
      baseSalary: person.baseSalary,
      allowances: person.allowances,
      unpaidDeduction,
      additions: 0,
      deductions: 0,
    };
    return {
      id: crypto.randomUUID(),
      runId: id,
      employeeId: person.id,
      employeeName: person.fullName,
      unpaidDays,
      ...line,
      netPay: netPay(line),
    };
  });
  const statements = [
    db.insert(payrollRuns).values({ id, period, createdBy: viewer.userId }),
    ...chunk(lines, 8).map((part) => db.insert(payrollLines).values(part)),
  ];
  await db.batch(statements as [(typeof statements)[0], ...(typeof statements)[number][]]);
  return { id };
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export async function getRun(viewer: Viewer, id: string) {
  requireAdmin(viewer);
  const [run] = await db.select().from(payrollRuns).where(eq(payrollRuns.id, id));
  if (!run) throw notFound();
  const lines = await db
    .select()
    .from(payrollLines)
    .where(eq(payrollLines.runId, id))
    .orderBy(asc(payrollLines.employeeName));
  const totals = lines.reduce(
    (t, l) => ({ gross: t.gross + l.baseSalary + l.allowances, net: t.net + l.netPay }),
    { gross: 0, net: 0 },
  );
  return { run, lines, totals: { gross: round(totals.gross), net: round(totals.net) } };
}

/** One-off additions and deductions, while the run is a draft. */
export async function adjustLine(viewer: Viewer, input: z.infer<typeof adjustInput>) {
  requireAdmin(viewer);
  const [line] = await db
    .select({ line: payrollLines, status: payrollRuns.status })
    .from(payrollLines)
    .innerJoin(payrollRuns, eq(payrollRuns.id, payrollLines.runId))
    .where(eq(payrollLines.id, input.lineId));
  if (!line) throw notFound();
  const next = { ...line.line, additions: input.additions, deductions: input.deductions };
  const [row] = await db
    .update(payrollLines)
    .set({ additions: input.additions, deductions: input.deductions, note: input.note, netPay: netPay(next) })
    .where(
      and(
        eq(payrollLines.id, input.lineId),
        inArray(
          payrollLines.runId,
          db.select({ id: payrollRuns.id }).from(payrollRuns).where(eq(payrollRuns.status, "draft")),
        ),
      ),
    )
    .returning();
  if (!row) throw new AppError(409, "This run is approved, so its lines are locked");
  return row;
}

export async function advanceRun(viewer: Viewer, id: string, to: "approved" | "finalized") {
  requireAdmin(viewer);
  const from = to === "approved" ? "draft" : "approved";
  const [row] = await db
    .update(payrollRuns)
    .set({ status: to })
    .where(and(eq(payrollRuns.id, id), eq(payrollRuns.status, from)))
    .returning();
  if (!row) throw new AppError(409, `Only a ${from} run can be ${to}`);
  return row;
}

export async function deleteDraftRun(viewer: Viewer, id: string) {
  requireAdmin(viewer);
  const [run] = await db
    .select({ id: payrollRuns.id })
    .from(payrollRuns)
    .where(and(eq(payrollRuns.id, id), eq(payrollRuns.status, "draft")));
  if (!run) throw new AppError(409, "Only a draft run can be deleted");
  await db.batch([
    db.delete(payrollLines).where(eq(payrollLines.runId, id)),
    db.delete(payrollRuns).where(eq(payrollRuns.id, id)),
  ]);
  return { id };
}

/** The viewer's own payslips, from finalized runs only. */
export async function myPayslips(viewer: Viewer) {
  if (!viewer.employee) return [];
  return db
    .select({ id: payrollLines.id, period: payrollRuns.period, netPay: payrollLines.netPay })
    .from(payrollLines)
    .innerJoin(payrollRuns, eq(payrollRuns.id, payrollLines.runId))
    .where(and(eq(payrollLines.employeeId, viewer.employee.id), eq(payrollRuns.status, "finalized")))
    .orderBy(desc(payrollRuns.period));
}

export async function getPayslip(viewer: Viewer, id: string) {
  if (!viewer.employee) throw notFound();
  const [row] = await db
    .select({ line: payrollLines, period: payrollRuns.period })
    .from(payrollLines)
    .innerJoin(payrollRuns, eq(payrollRuns.id, payrollLines.runId))
    .where(
      and(
        eq(payrollLines.id, id),
        eq(payrollLines.employeeId, viewer.employee.id),
        eq(payrollRuns.status, "finalized"),
      ),
    );
  if (!row) throw notFound();
  return { ...row.line, period: row.period };
}

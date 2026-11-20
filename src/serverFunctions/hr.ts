import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as attendance from "@/server/attendance";
import * as documents from "@/server/documents";
import * as people from "@/server/employees";
import * as leave from "@/server/leave";
import * as payroll from "@/server/payroll";
import { getViewer } from "@/server/viewer";
import * as input from "@/shared/inputs";

// Every function runs behind ensureUserMiddleware: `context.user` is the
// member the Gateway signed in, and each query checks what they may do.
const id = z.object({ id: z.string().min(1) }).strict();
const decision = z.object({ id: z.string().min(1), decision: z.enum(["approved", "rejected"]) }).strict();

export const getMe = createServerFn().middleware([ensureUserMiddleware]).handler(async ({ context }) => {
  const viewer = await getViewer(context.user);
  const isManager = viewer.employee
    ? (await people.allVisible(viewer)).some((e) => e.managerId === viewer.employee!.id)
    : false;
  return {
    email: viewer.email,
    admin: viewer.admin,
    isManager,
    employee: viewer.employee ? await people.getEmployee(viewer, viewer.employee.id) : null,
  };
});

// Employees (F001)
export const listEmployees = createServerFn().middleware([ensureUserMiddleware])
  .validator((d: unknown) => input.listInput.parse(d))
  .handler(async ({ data, context }) => people.listEmployees(await getViewer(context.user), data));
export const getEmployee = createServerFn().middleware([ensureUserMiddleware])
  .validator((d: unknown) => id.parse(d))
  .handler(async ({ data, context }) => {
    const viewer = await getViewer(context.user);
    const employee = await people.getEmployee(viewer, data.id);
    const docs = await documents.listDocuments(viewer, data.id);
    return { employee, documents: docs, admin: viewer.admin };
  });
export const employeeOptions = createServerFn().middleware([ensureUserMiddleware]).handler(async ({ context }) => {
  const viewer = await getViewer(context.user);
  return viewer.admin ? people.employeeOptions(viewer) : [];
});
export const saveEmployee = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware])
  .validator((d: unknown) => input.employeeInput.parse(d))
  .handler(async ({ data, context }) => people.saveEmployee(await getViewer(context.user), data));
export const setEmployeeStatus = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware])
  .validator((d: unknown) => z.object({ id: z.string(), status: z.enum(["active", "archived"]) }).strict().parse(d))
  .handler(async ({ data, context }) => people.setStatus(await getViewer(context.user), data.id, data.status));

// Documents (F002)
export const listDocuments = createServerFn().middleware([ensureUserMiddleware]).handler(async ({ context }) => {
  const viewer = await getViewer(context.user);
  return {
    admin: viewer.admin,
    documents: await documents.listDocuments(viewer),
    owners: viewer.admin ? await people.employeeOptions(viewer) : [],
  };
});
export const deleteDocument = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware])
  .validator((d: unknown) => id.parse(d))
  .handler(async ({ data, context }) => documents.deleteDocument(await getViewer(context.user), data.id));

// Leave (F003)
export const getLeave = createServerFn().middleware([ensureUserMiddleware]).handler(async ({ context }) => {
  const viewer = await getViewer(context.user);
  return { ...(await leave.myLeave(viewer)), approvals: await leave.approvals(viewer), admin: viewer.admin, linked: !!viewer.employee };
});
export const getLeaveTypes = createServerFn().middleware([ensureUserMiddleware]).handler(async ({ context }) => {
  const viewer = await getViewer(context.user);
  return { admin: viewer.admin, types: await leave.listLeaveTypes() };
});
export const createLeaveType = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware])
  .validator((d: unknown) => input.leaveTypeInput.parse(d))
  .handler(async ({ data, context }) => leave.createLeaveType(await getViewer(context.user), data));
export const updateLeaveType = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware])
  .validator((d: unknown) => input.leaveTypeInput.extend({ id: z.string() }).parse(d))
  .handler(async ({ data: { id, ...input }, context }) => leave.updateLeaveType(await getViewer(context.user), id, input));
export const requestLeave = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware])
  .validator((d: unknown) => input.leaveRequestInput.parse(d))
  .handler(async ({ data, context }) => leave.requestLeave(await getViewer(context.user), data));
export const cancelLeave = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware])
  .validator((d: unknown) => id.parse(d))
  .handler(async ({ data, context }) => leave.cancelLeave(await getViewer(context.user), data.id));
export const decideLeave = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware])
  .validator((d: unknown) => decision.parse(d))
  .handler(async ({ data, context }) => leave.decideLeave(await getViewer(context.user), data.id, data.decision));

// Attendance (F004)
export const getAttendance = createServerFn().middleware([ensureUserMiddleware])
  .validator((d: unknown) => input.monthInput.parse(d))
  .handler(async ({ data, context }) => {
    const viewer = await getViewer(context.user);
    return {
      ...(await attendance.myAttendance(viewer, data.month)),
      approvals: await attendance.pendingCorrections(viewer),
    };
  });
export const getTeamAttendance = createServerFn().middleware([ensureUserMiddleware])
  .validator((d: unknown) => input.monthInput.parse(d))
  .handler(async ({ data, context }) => attendance.teamAttendance(await getViewer(context.user), data.month));
export const checkIn = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware]).handler(async ({ context }) => attendance.checkIn(await getViewer(context.user)));
export const checkOut = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware]).handler(async ({ context }) => attendance.checkOut(await getViewer(context.user)));
export const requestCorrection = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware])
  .validator((d: unknown) => input.correctionInput.parse(d))
  .handler(async ({ data, context }) => attendance.requestCorrection(await getViewer(context.user), data));
export const decideCorrection = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware])
  .validator((d: unknown) => decision.parse(d))
  .handler(async ({ data, context }) =>
    attendance.decideCorrection(await getViewer(context.user), data.id, data.decision),
  );

// Payroll (F005)
export const listRuns = createServerFn().middleware([ensureUserMiddleware]).handler(async ({ context }) => payroll.listRuns(await getViewer(context.user)));
export const createRun = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware])
  .validator((d: unknown) => input.periodInput.parse(d))
  .handler(async ({ data, context }) => payroll.createRun(await getViewer(context.user), data.period));
export const getRun = createServerFn().middleware([ensureUserMiddleware])
  .validator((d: unknown) => id.parse(d))
  .handler(async ({ data, context }) => payroll.getRun(await getViewer(context.user), data.id));
export const adjustLine = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware])
  .validator((d: unknown) => input.adjustInput.parse(d))
  .handler(async ({ data, context }) => payroll.adjustLine(await getViewer(context.user), data));
export const advanceRun = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware])
  .validator((d: unknown) => z.object({ id: z.string(), to: z.enum(["approved", "finalized"]) }).strict().parse(d))
  .handler(async ({ data, context }) => payroll.advanceRun(await getViewer(context.user), data.id, data.to));
export const deleteRun = createServerFn({ method: "POST" }).middleware([ensureUserMiddleware])
  .validator((d: unknown) => id.parse(d))
  .handler(async ({ data, context }) => payroll.deleteDraftRun(await getViewer(context.user), data.id));
export const myPayslips = createServerFn().middleware([ensureUserMiddleware]).handler(async ({ context }) => payroll.myPayslips(await getViewer(context.user)));
export const getPayslip = createServerFn().middleware([ensureUserMiddleware])
  .validator((d: unknown) => id.parse(d))
  .handler(async ({ data, context }) => payroll.getPayslip(await getViewer(context.user), data.id));

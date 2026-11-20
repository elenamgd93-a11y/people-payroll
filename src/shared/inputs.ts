import { z } from "zod";

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");
const money = z.coerce.number().min(0).max(100_000_000);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const amount = z.number().min(0).max(100_000_000);

export const employeeInput = z
  .object({
    id: z.string().optional(),
    fullName: z.string().trim().min(1, "Name is required").max(120),
    email: z.string().trim().toLowerCase().email("Enter a valid email"),
    jobTitle: z.string().trim().max(120).default(""),
    department: z.string().trim().max(80).default(""),
    managerId: z.string().nullable().default(null),
    hireDate: day,
    baseSalary: money,
    allowances: money,
  })
  .strict();

export const listInput = z
  .object({
    q: z.string().max(100).optional(),
    department: z.string().max(80).optional(),
    status: z.enum(["active", "archived", "all"]).optional(),
    sort: z.enum(["name", "department", "hireDate", "jobTitle"]).optional(),
    dir: z.enum(["asc", "desc"]).optional(),
    page: z.coerce.number().int().min(1).optional(),
  })
  .strict();

export const leaveTypeInput = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(60),
    allowanceDays: z.number().int().min(0).max(366).nullable(),
    carryoverCap: z.number().int().min(0).max(366),
    paid: z.boolean(),
  })
  .strict();

export const leaveRequestInput = z
  .object({
    typeId: z.string().min(1, "Pick a leave type"),
    startDate: day,
    endDate: day,
    reason: z.string().trim().max(500).default(""),
  })
  .strict();

export const decisionInput = z
  .object({ decision: z.enum(["approved", "rejected"]) })
  .strict();

export const monthInput = z
  .object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional() })
  .strict();

export const correctionInput = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    checkIn: hhmm,
    checkOut: hhmm.nullable(),
    reason: z.string().trim().min(1, "Give a reason").max(500),
  })
  .strict();

export const periodInput = z
  .object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick a month") })
  .strict();

export const adjustInput = z
  .object({ lineId: z.string(), additions: amount, deductions: amount, note: z.string().trim().max(300) })
  .strict();

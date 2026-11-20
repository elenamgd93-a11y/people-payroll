import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  text("created_at")
    .notNull()
    .default(sql`(current_timestamp)`);

/** People the Gateway signed in, keyed by the Gateway's user id. */
export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull(),
  createdAt: createdAt(),
});

export const employees = sqliteTable(
  "employees",
  {
    id: text("id").primaryKey(),
    /** Set the first time the member with this work email signs in. */
    userId: text("user_id"),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    jobTitle: text("job_title").notNull().default(""),
    department: text("department").notNull().default(""),
    managerId: text("manager_id"),
    hireDate: text("hire_date").notNull(),
    status: text("status", { enum: ["active", "archived"] })
      .notNull()
      .default("active"),
    baseSalary: real("base_salary").notNull().default(0),
    allowances: real("allowances").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("employees_email_unique").on(t.email),
    uniqueIndex("employees_user_unique").on(t.userId),
    index("employees_manager_idx").on(t.managerId),
  ],
);

export const documents = sqliteTable(
  "documents",
  {
    id: text("id").primaryKey(),
    /** Null for a company document. */
    employeeId: text("employee_id"),
    type: text("type", {
      enum: ["passport", "visa", "id", "contract", "trade_licence", "other"],
    }).notNull(),
    number: text("number").notNull().default(""),
    expiresOn: text("expires_on"),
    fileName: text("file_name").notNull(),
    contentType: text("content_type").notNull(),
    size: integer("size").notNull(),
    fileKey: text("file_key").notNull(),
    uploadedBy: text("uploaded_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("documents_employee_idx").on(t.employeeId)],
);

export const leaveTypes = sqliteTable("leave_types", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** Days per year; null is unlimited. */
  allowanceDays: integer("allowance_days"),
  carryoverCap: integer("carryover_cap").notNull().default(0),
  paid: integer("paid", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

export const leaveRequests = sqliteTable(
  "leave_requests",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id").notNull(),
    typeId: text("type_id").notNull(),
    startDate: text("start_date").notNull(),
    endDate: text("end_date").notNull(),
    days: integer("days").notNull(),
    reason: text("reason").notNull().default(""),
    status: text("status", {
      enum: ["pending", "approved", "rejected", "cancelled"],
    })
      .notNull()
      .default("pending"),
    decidedBy: text("decided_by"),
    decidedAt: text("decided_at"),
    createdAt: createdAt(),
  },
  (t) => [index("leave_requests_employee_idx").on(t.employeeId)],
);

export const attendance = sqliteTable(
  "attendance",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id").notNull(),
    /** The workday, YYYY-MM-DD in the company's time zone. */
    date: text("date").notNull(),
    checkInAt: text("check_in_at"),
    checkOutAt: text("check_out_at"),
  },
  (t) => [uniqueIndex("attendance_employee_date").on(t.employeeId, t.date)],
);

export const attendanceCorrections = sqliteTable(
  "attendance_corrections",
  {
    id: text("id").primaryKey(),
    employeeId: text("employee_id").notNull(),
    date: text("date").notNull(),
    /** HH:MM in the company's time zone. */
    checkIn: text("check_in").notNull(),
    checkOut: text("check_out"),
    reason: text("reason").notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected"] })
      .notNull()
      .default("pending"),
    decidedBy: text("decided_by"),
    createdAt: createdAt(),
  },
  (t) => [index("attendance_corrections_employee_idx").on(t.employeeId)],
);

export const payrollRuns = sqliteTable(
  "payroll_runs",
  {
    id: text("id").primaryKey(),
    /** YYYY-MM */
    period: text("period").notNull(),
    status: text("status", { enum: ["draft", "approved", "finalized"] })
      .notNull()
      .default("draft"),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("payroll_runs_period").on(t.period)],
);

export const payrollLines = sqliteTable(
  "payroll_lines",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    employeeId: text("employee_id").notNull(),
    employeeName: text("employee_name").notNull(),
    baseSalary: real("base_salary").notNull(),
    allowances: real("allowances").notNull(),
    unpaidDays: integer("unpaid_days").notNull().default(0),
    unpaidDeduction: real("unpaid_deduction").notNull().default(0),
    additions: real("additions").notNull().default(0),
    deductions: real("deductions").notNull().default(0),
    note: text("note").notNull().default(""),
    netPay: real("net_pay").notNull(),
  },
  (t) => [
    uniqueIndex("payroll_lines_run_employee").on(t.runId, t.employeeId),
  ],
);

// Shared helpers for the suites.
export const YEAR = new Date().getUTCFullYear();

export function isoDay(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** Opens a select by its test id and picks the option with this name. */
export async function pick(page, testId, option) {
  await page.getByTestId(testId).click();
  await page.getByRole("option", { name: option, exact: true }).click();
}

export async function json(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Not JSON (${response.status}): ${text.slice(0, 300)}`);
  }
}

/** Seeds an organization's records straight into D1. */
export async function seed(runtime) {
  const db = await runtime.database();
  const run = (sql, ...args) => db.prepare(sql).bind(...args).run();
  await run(
    `insert into employees (id, email, full_name, job_title, department, manager_id, hire_date, status, base_salary, allowances)
     values ('emp-layla', 'owner@example.test', 'Layla Haddad', 'Head of People', 'People', null, '2021-01-10', 'active', 30000, 5000),
            ('emp-omar', 'member@example.test', 'Omar Siddiqui', 'Accountant', 'Finance', 'emp-layla', '2023-04-02', 'active', 12000, 3000),
            ('emp-priya', 'priya@example.test', 'Priya Nair', 'Analyst', 'Finance', null, '2024-06-15', 'active', 15000, 2000)`,
  );
  await run(
    `insert into documents (id, employee_id, type, number, expires_on, file_name, content_type, size, file_key, uploaded_by)
     values ('doc-priya', 'emp-priya', 'passport', 'PX-55', '2030-01-01', 'priya.pdf', 'application/pdf', 4, 'documents/doc-priya', 'owner'),
            ('doc-company', null, 'trade_licence', 'TL-9', '2030-01-01', 'licence.pdf', 'application/pdf', 4, 'documents/doc-company', 'owner')`,
  );
  await run(
    `insert into leave_types (id, name, allowance_days, carryover_cap, paid) values ('lt-annual', 'Annual leave', 22, 5, 1)`,
  );
  await run(
    `insert into leave_requests (id, employee_id, type_id, start_date, end_date, days, reason, status)
     values ('lr-omar', 'emp-omar', 'lt-annual', '${YEAR}-02-02', '${YEAR}-02-03', 2, 'Trip', 'pending'),
            ('lr-priya', 'emp-priya', 'lt-annual', '${YEAR}-02-02', '${YEAR}-02-03', 2, 'Trip', 'pending')`,
  );
  await run(
    `insert into payroll_runs (id, period, status, created_by) values ('run-final', '${YEAR - 1}-01', 'finalized', 'owner'), ('run-draft', '${YEAR - 1}-02', 'draft', 'owner')`,
  );
  await run(
    `insert into payroll_lines (id, run_id, employee_id, employee_name, base_salary, allowances, net_pay)
     values ('pl-omar-final', 'run-final', 'emp-omar', 'Omar Siddiqui', 12000, 3000, 15000),
            ('pl-priya-final', 'run-final', 'emp-priya', 'Priya Nair', 15000, 2000, 17000),
            ('pl-omar-draft', 'run-draft', 'emp-omar', 'Omar Siddiqui', 12000, 3000, 15000)`,
  );
}

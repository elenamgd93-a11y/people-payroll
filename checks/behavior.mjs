// The main path of every feature: F001 records, F002 documents, F003 leave,
// F004 attendance, F005 payroll.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { YEAR, isoDay, json, pick } from "./lib.mjs";

const runtime = await startRuntime({ bindings: { TIME_ZONE: { type: "text", value: "UTC" } } });
try {
  const owner = await (await runtime.context("owner")).newPage();
  const member = await (await runtime.context("member")).newPage();

  // F001: the admin builds the directory.
  await owner.goto("/employees");
  await runtime.assertBackLink(owner);
  async function addEmployee(e) {
    await owner.getByTestId("add-employee").click();
    const dialog = owner.getByRole("dialog");
    await dialog.getByLabel("Full name").fill(e.name);
    await dialog.getByLabel("Work email").fill(e.email);
    await dialog.getByLabel("Job title").fill(e.title);
    await dialog.getByLabel("Department").fill(e.dept);
    if (e.manager) await pick(owner, "manager-select", e.manager);
    await dialog.getByLabel("Hire date").fill(e.hired);
    await dialog.getByLabel("Base monthly salary").fill(String(e.base));
    await dialog.getByLabel("Allowances").fill(String(e.allowances));
    await dialog.getByRole("button", { name: "Save" }).click();
    await expect(dialog).toBeHidden();
    await expect(owner.getByTestId("employee-row").filter({ hasText: e.name })).toBeVisible();
  }
  await addEmployee({ name: "Layla Haddad", email: "owner@example.test", title: "Head of People", dept: "People", hired: "2021-01-10", base: 30000, allowances: 5000 });
  await addEmployee({ name: "Omar Siddiqui", email: "member@example.test", title: "Accountant", dept: "Finance", manager: "Layla Haddad", hired: "2023-04-02", base: 12000, allowances: 3000 });
  await addEmployee({ name: "Priya Nair", email: "priya@example.test", title: "Financial Analyst", dept: "Finance", manager: "Layla Haddad", hired: "2024-06-15", base: 15000, allowances: 2000 });
  await addEmployee({ name: "Daniel Okafor", email: "daniel@example.test", title: "Sales Lead", dept: "Sales", manager: "Layla Haddad", hired: "2022-09-01", base: 18000, allowances: 2500 });

  // Search, filter and sort.
  await owner.goto("/employees?q=omar");
  await expect(owner.getByTestId("employee-row")).toHaveCount(1);
  await owner.goto("/employees?department=Finance&sort=name");
  await expect(owner.getByTestId("employee-row")).toHaveText([/Omar Siddiqui/, /Priya Nair/]);
  await owner.goto("/employees?sort=name&dir=desc");
  await expect(owner.getByTestId("employee-row").first()).toContainText("Priya Nair");

  // Priya: a teammate's approved leave, then archived.
  await owner.goto("/employees");
  await owner.getByRole("link", { name: "Priya Nair" }).click();
  const priyaId = owner.url().split("/").pop();
  const types = []; // filled below
  await expect(owner.getByTestId("salary")).toContainText("15,000");

  // F003: leave types.
  await owner.goto("/leave/types");
  async function addType(t) {
    await owner.getByLabel("Name").fill(t.name);
    await owner.getByLabel("Days per year").fill(t.days);
    await owner.getByLabel("Carryover cap").fill(t.carry);
    if (!t.paid) await owner.getByRole("checkbox", { name: "Paid" }).click();
    await owner.getByRole("button", { name: "Add leave type" }).click();
    await expect(owner.getByTestId("leave-type-row").filter({ hasText: t.name })).toBeVisible();
  }
  await addType({ name: "Annual leave", days: "22", carry: "5", paid: true });
  await addType({ name: "Unpaid leave", days: "", carry: "0", paid: false });
  await expect(owner.getByTestId("leave-type-row").filter({ hasText: "Unpaid leave" })).toContainText("Unlimited");
  types.push("Annual leave");

  // Priya's approved leave overlaps the dates Omar asks for.
  const db = await runtime.database();
  const annualId = (await db.prepare("select id from leave_types where name = 'Annual leave'").first()).id;
  await db
    .prepare(`insert into leave_requests (id, employee_id, type_id, start_date, end_date, days, reason, status) values ('seed-priya', ?, ?, '${YEAR}-02-03', '${YEAR}-02-05', 3, 'Conference', 'approved')`)
    .bind(priyaId, annualId)
    .run();

  await owner.goto(`/employees/${priyaId}`);
  await owner.getByRole("button", { name: "Archive" }).click();
  await owner.getByRole("button", { name: "Archive employee" }).click();
  await expect(owner.getByTestId("employee-status")).toHaveText("Archived");
  await owner.goto("/employees?status=archived");
  await expect(owner.getByTestId("employee-row")).toHaveText([/Priya Nair/]);

  // The member is linked by email and sees their profile, without salary.
  await member.goto("/");
  await expect(member.getByRole("heading", { name: "Omar Siddiqui" })).toBeVisible();
  await expect(member.getByTestId("manager")).toHaveText("Layla Haddad");
  await expect(member.getByTestId("salary")).toHaveCount(0);
  const me = await json(await runtime.fetch("/api/me", { role: "member" }));
  expect(me.employee.fullName).toBe("Omar Siddiqui");
  expect(me.employee).not.toHaveProperty("baseSalary");
  const omarId = me.employee.id;
  const ownerView = await json(await runtime.fetch(`/api/employees/${omarId}`, { role: "owner" }));
  expect(ownerView.baseSalary).toBe(12000);

  // F003: the member asks for leave.
  await member.goto("/leave");
  await expect(member.getByTestId("balance").filter({ hasText: "Annual leave" })).toContainText("27 days"); // 22 plus 5 carried over
  async function request(type, from, to, reason) {
    await pick(member, "leave-type-select", type);
    await member.getByLabel("From").fill(from);
    await member.getByLabel("To").fill(to);
    await member.getByLabel("Reason").fill(reason);
    await member.getByRole("button", { name: "Request leave" }).click();
  }
  await request("Annual leave", `${YEAR}-02-02`, `${YEAR}-02-04`, "Family visit");
  await expect(member.getByTestId("leave-row").filter({ hasText: "Family visit" })).toContainText("Pending");
  await request("Annual leave", `${YEAR}-02-04`, `${YEAR}-02-04`, "Dentist");
  await expect(member.getByRole("alert")).toContainText("overlaps");
  await request("Annual leave", `${YEAR}-05-01`, `${YEAR}-06-15`, "Long trip");
  await expect(member.getByRole("alert")).toContainText("balance");
  await request("Unpaid leave", `${YEAR}-03-10`, `${YEAR}-03-11`, "Moving house");
  await expect(member.getByTestId("leave-row").filter({ hasText: "Moving house" })).toContainText("Pending");
  await request("Annual leave", `${YEAR}-09-07`, `${YEAR}-09-07`, "Changed plans");
  const changed = member.getByTestId("leave-row").filter({ hasText: "Changed plans" });
  await changed.getByRole("button", { name: "Cancel" }).click();
  await expect(changed).toContainText("Cancelled");

  // The manager (an admin) approves and sees who else on the team is away.
  await owner.goto("/leave");
  const familyVisit = owner.getByTestId("approval-row").filter({ hasText: "Family visit" });
  await expect(familyVisit).toContainText("Priya Nair");
  await familyVisit.getByRole("button", { name: "Approve" }).click();
  await expect(familyVisit).toHaveCount(0);
  await owner.getByTestId("approval-row").filter({ hasText: "Moving house" }).getByRole("button", { name: "Approve" }).click();
  await expect(owner.getByTestId("approval-row")).toHaveCount(0);
  await member.goto("/leave");
  await expect(member.getByTestId("leave-row").filter({ hasText: "Family visit" })).toContainText("Approved");
  await expect(member.getByTestId("balance").filter({ hasText: "Annual leave" })).toContainText("24 days");

  // F004: check in and out; the server records the time.
  await member.goto("/attendance");
  await member.getByRole("button", { name: "Check in" }).click();
  await expect(member.getByRole("button", { name: "Check out" })).toBeVisible();
  await member.getByRole("button", { name: "Check out" }).click();
  await expect(member.getByTestId("today-status")).toContainText("Checked out");
  await expect(member.getByRole("button", { name: "Check in" })).toHaveCount(0);
  const again = await runtime.fetch("/api/attendance/check-in", { role: "member", method: "POST" });
  expect(again.status).toBe(409);
  const today = isoDay(0);
  await expect(member.getByTestId("attendance-row").filter({ hasText: today })).toBeVisible();

  // A correction for today, approved by the manager.
  await member.getByLabel("Date").fill(today);
  await member.getByLabel("Check-in time").fill("09:30");
  await member.getByLabel("Check-out time").fill("17:30");
  await member.getByLabel("Reason").fill("Badge reader was down");
  await member.getByRole("button", { name: "Request correction" }).click();
  await expect(member.getByTestId("correction-row").filter({ hasText: "Badge reader was down" })).toContainText("Pending");
  await owner.goto("/attendance");
  const correction = owner.getByTestId("correction-approval").filter({ hasText: "Badge reader was down" });
  await correction.getByRole("button", { name: "Approve" }).click();
  await expect(correction).toHaveCount(0);
  await member.goto("/attendance");
  const fixed = member.getByTestId("attendance-row").filter({ hasText: today });
  await expect(fixed).toContainText("8.0");
  await expect(fixed).toContainText("Late");
  const mine = await json(await runtime.fetch("/api/attendance", { role: "member" }));
  expect(mine.records.find((r) => r.date === today).hours).toBe(8);

  await owner.goto("/attendance/team");
  const omarRow = owner.getByTestId("team-row").filter({ hasText: "Omar Siddiqui" });
  await expect(omarRow.getByTestId("days-present")).toHaveText("1");
  await expect(omarRow.getByTestId("late-days")).toHaveText("1");
  await expect(omarRow.getByTestId("hours")).toHaveText("8.0");

  // F002: documents, with expiry flags.
  await owner.goto("/documents");
  async function upload(d) {
    await owner.getByRole("button", { name: "Upload document" }).click();
    const dialog = owner.getByRole("dialog");
    await pick(owner, "doc-owner-select", d.owner);
    await pick(owner, "doc-type-select", d.type);
    await dialog.getByLabel("Document number").fill(d.number);
    if (d.expires) await dialog.getByLabel("Expires on").fill(d.expires);
    await dialog.getByTestId("doc-file").setInputFiles({ name: d.file, mimeType: "application/pdf", buffer: Buffer.from(d.body) });
    await dialog.getByRole("button", { name: "Upload" }).click();
    await expect(dialog).toBeHidden();
  }
  await upload({ owner: "Omar Siddiqui", type: "Passport", number: "N4412093", expires: isoDay(20), file: "passport.pdf", body: "%PDF passport scan" });
  await upload({ owner: "Company", type: "Trade licence", number: "TL-778201", expires: isoDay(-3), file: "licence.pdf", body: "%PDF licence" });
  await upload({ owner: "Omar Siddiqui", type: "Contract", number: "C-2023-118", expires: "", file: "contract.pdf", body: "%PDF contract" });
  await expect(owner.getByTestId("doc-row").filter({ hasText: "N4412093" })).toContainText("Expires soon");
  await expect(owner.getByTestId("doc-row").filter({ hasText: "TL-778201" })).toContainText("Expired");

  await member.goto("/documents");
  await expect(member.getByTestId("doc-row")).toHaveCount(2);
  await expect(member.getByTestId("doc-row").filter({ hasText: "TL-778201" })).toHaveCount(0);
  const href = await member.getByTestId("doc-row").filter({ hasText: "N4412093" }).getByRole("link", { name: "Download" }).getAttribute("href");
  const file = await runtime.fetch(href, { role: "member" });
  expect(file.status).toBe(200);
  expect(await file.text()).toBe("%PDF passport scan");

  const licence = owner.getByTestId("doc-row").filter({ hasText: "TL-778201" });
  const licenceHref = await licence.getByRole("link", { name: "Download" }).getAttribute("href");
  await licence.getByRole("button", { name: "Delete" }).click();
  await owner.getByRole("button", { name: "Delete document" }).click();
  await expect(licence).toHaveCount(0);
  expect((await runtime.fetch(licenceHref, { role: "owner" })).status).toBe(404);

  // F005: a payroll run for March.
  await owner.goto("/payroll");
  await owner.getByLabel("Period").fill(`${YEAR}-03`);
  await owner.getByRole("button", { name: "Create run" }).click();
  await expect(owner.getByTestId("run-status")).toHaveText("Draft");
  const lines = owner.getByTestId("payroll-line");
  await expect(lines).toHaveCount(3); // Priya is archived
  await expect(lines.filter({ hasText: "Priya Nair" })).toHaveCount(0);
  const omarLine = lines.filter({ hasText: "Omar Siddiqui" });
  await expect(omarLine.getByTestId("unpaid-deduction")).toHaveText("800.00");
  await expect(omarLine.getByTestId("net-pay")).toHaveText("14,200.00");
  await omarLine.getByRole("button", { name: "Adjust" }).click();
  const adjust = owner.getByRole("dialog");
  await adjust.getByLabel("Additions").fill("500");
  await adjust.getByLabel("Deductions").fill("0");
  await adjust.getByLabel("Note").fill("Overtime in March close");
  await adjust.getByRole("button", { name: "Save" }).click();
  await expect(omarLine.getByTestId("net-pay")).toHaveText("14,700.00");
  await owner.getByRole("button", { name: "Approve run" }).click();
  await expect(owner.getByTestId("run-status")).toHaveText("Approved");
  await expect(owner.getByRole("button", { name: "Adjust" })).toHaveCount(0);

  await member.goto("/payslips");
  await expect(member.getByTestId("payslip-row")).toHaveCount(0);

  await owner.getByRole("button", { name: "Finalize run" }).click();
  await expect(owner.getByTestId("run-status")).toHaveText("Finalized");

  await member.goto("/payslips");
  await member.getByTestId("payslip-row").filter({ hasText: `${YEAR}-03` }).getByRole("link").first().click();
  await expect(member.getByTestId("net-pay")).toHaveText("14,700.00");
  await expect(member.getByText("Overtime in March close")).toBeVisible();

  await owner.reload();
  await expect(owner.getByTestId("payroll-line")).toHaveCount(3);
  await runtime.screenshot(owner);

  // Phone-sized smoke.
  const phone = await (await runtime.context("member", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("/leave");
  await expect(phone.getByTestId("balance").filter({ hasText: "Annual leave" })).toBeVisible();
  await expect(phone.getByRole("link", { name: "Attendance" })).toBeVisible();
  console.log("behavior: ok");
} finally {
  await runtime.close();
}

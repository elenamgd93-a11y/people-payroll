// Who may read and change what. Covers F001-F005 and X001.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { YEAR, json, seed } from "./lib.mjs";

const runtime = await startRuntime({ bindings: { TIME_ZONE: { type: "text", value: "UTC" } } });
try {
  await seed(runtime);

  // Anonymous visitors and other organizations are refused everywhere.
  await runtime.assertPrivateAccess([
    "/",
    "/employees",
    "/documents",
    "/leave",
    "/attendance",
    "/payslips",
    "/api/me",
  ]);
  for (const path of ["/api/employees/emp-omar", "/api/payslips/pl-omar-final", "/api/documents/doc-priya/file"]) {
    for (const role of [undefined, "outsider"]) {
      const res = await runtime.fetch(path, { role });
      expect([401, 403], `${role ?? "anonymous"} ${path}`).toContain(res.status);
    }
  }

  // The member is linked to their own record by email and sees no salary.
  const me = await json(await runtime.fetch("/api/me", { role: "member" }));
  expect(me.employee.id).toBe("emp-omar");
  expect(me.isAdmin).toBe(false);
  const own = await json(await runtime.fetch("/api/employees/emp-omar", { role: "member" }));
  expect(own.fullName).toBe("Omar Siddiqui");
  expect(own).not.toHaveProperty("baseSalary");
  expect(own).not.toHaveProperty("allowances");

  // Another employee's record, documents and payslips stay hidden from a member.
  expect((await runtime.fetch("/api/employees/emp-priya", { role: "member" })).status).toBe(404);
  expect((await runtime.fetch("/api/employees/emp-layla", { role: "member" })).status).toBe(404);
  const list = await json(await runtime.fetch("/api/employees", { role: "member" }));
  expect(list.map((e) => e.id).sort()).toEqual(["emp-omar"]);
  const page = await runtime.fetch("/employees/emp-priya", { role: "member" });
  expect(await page.text()).not.toContain("Priya Nair");
  expect((await runtime.fetch("/api/documents/doc-priya/file", { role: "member" })).status).toBe(404);
  expect((await runtime.fetch("/api/documents/doc-company/file", { role: "member" })).status).toBe(404);
  expect((await runtime.fetch("/api/payslips/pl-priya-final", { role: "member" })).status).toBe(404);
  // Only finalized runs make payslips.
  expect((await runtime.fetch("/api/payslips/pl-omar-draft", { role: "member" })).status).toBe(404);
  const slip = await json(await runtime.fetch("/api/payslips/pl-omar-final", { role: "member" }));
  expect(slip.netPay).toBe(15000);

  // The manager (an admin here) sees the report with salary.
  const asAdmin = await json(await runtime.fetch("/api/employees/emp-omar", { role: "owner" }));
  expect(asAdmin.baseSalary).toBe(12000);

  // Admin-only: payroll runs.
  expect((await runtime.fetch("/api/payroll-runs", { role: "member" })).status).toBe(403);
  const runs = await json(await runtime.fetch("/api/payroll-runs", { role: "owner" }));
  expect(runs.map((r) => r.id).sort()).toEqual(["run-draft", "run-final"]);
  const payrollPage = await runtime.fetch("/payroll", { role: "member" });
  expect(await payrollPage.text()).not.toContain(`${YEAR - 1}-02`);

  // A member never decides leave: neither their own nor someone else's.
  const decide = (role, id, decision) =>
    runtime.fetch(`/api/leave-requests/${id}/decision`, {
      role,
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ decision }),
    });
  expect((await decide("member", "lr-omar", "approved")).status).toBe(403);
  expect((await decide("member", "lr-priya", "approved")).status).toBe(403);
  const decided = await decide("owner", "lr-omar", "approved");
  expect(decided.status).toBe(200);
  expect((await json(decided)).status).toBe("approved");
  // Decided once only.
  expect((await decide("owner", "lr-omar", "rejected")).status).toBe(409);

  // The member checks in for themselves, once a day.
  const checkIn = () => runtime.fetch("/api/attendance/check-in", { role: "member", method: "POST" });
  expect((await checkIn()).status).toBe(200);
  expect((await checkIn()).status).toBe(409);

  // No sign-in page of the app's own.
  for (const path of ["/login", "/signin", "/sign-in", "/signup", "/register"]) {
    const res = await runtime.fetch(path, { role: "member" });
    expect(res.status, path).toBe(404);
  }
  const home = await (await runtime.fetch("/", { role: "member" })).text();
  expect(home).not.toMatch(/type="password"/);
  console.log("authorization: ok");
} finally {
  await runtime.close();
}

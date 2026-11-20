// Records outlive a restart.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { json } from "./lib.mjs";

const runtime = await startRuntime({ bindings: { TIME_ZONE: { type: "text", value: "UTC" } } });
try {
  const owner = await (await runtime.context("owner")).newPage();
  await owner.goto("/employees");
  await owner.getByTestId("add-employee").click();
  const dialog = owner.getByRole("dialog");
  await dialog.getByLabel("Full name").fill("Sara Mansour");
  await dialog.getByLabel("Work email").fill("owner@example.test");
  await dialog.getByLabel("Job title").fill("Operations Manager");
  await dialog.getByLabel("Department").fill("Operations");
  await dialog.getByLabel("Hire date").fill("2020-02-01");
  await dialog.getByLabel("Base monthly salary").fill("21000");
  await dialog.getByLabel("Allowances").fill("4000");
  await dialog.getByRole("button", { name: "Save" }).click();
  await expect(dialog).toBeHidden();

  const checkIn = await runtime.fetch("/api/attendance/check-in", { role: "owner", method: "POST" });
  expect(checkIn.status).toBe(200);

  await runtime.restart();

  const list = await json(await runtime.fetch("/api/employees", { role: "owner" }));
  const sara = list.find((e) => e.fullName === "Sara Mansour");
  expect(sara.baseSalary).toBe(21000);
  const mine = await json(await runtime.fetch("/api/attendance", { role: "owner" }));
  expect(mine.records.length).toBe(1);
  expect(mine.records[0].checkInAt).toBeTruthy();
  const page = await (await runtime.context("owner")).newPage();
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sara Mansour" })).toBeVisible();
  console.log("persistence: ok");
} finally {
  await runtime.close();
}

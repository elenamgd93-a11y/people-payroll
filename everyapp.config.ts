import { defineEveryApp } from "@every-app/sdk";

// defineEveryApp types the manifest. The Gateway keeps it; the Worker gets
// the bindings it lists (env.DB, env.files), never the file.
export default defineEveryApp({
  id: "people-payroll",
  name: "People & Payroll",
  description:
    "Employee records and documents, leave, attendance and monthly payroll for a small company.",
  icon: "/icon.svg",
  resources: {
    d1: ["DB"],
    r2: ["files"],
  },
  settings: [
    {
      name: "TIME_ZONE",
      why: "Decides which day a check-in counts for and whether it is late.",
      how: "An IANA time zone name, such as Asia/Dubai or Europe/London.",
      type: "text",
      default: "UTC",
    },
  ],
});

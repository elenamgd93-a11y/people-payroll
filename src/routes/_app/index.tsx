import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { UserRound } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { EmployeeFacts } from "@/client/components/EmployeeFacts";

export const Route = createFileRoute("/_app/")({
  head: () => ({ meta: [{ title: "My profile · People & Payroll" }] }),
  component: Profile,
});

const layout = getRouteApi("/_app");

function Profile() {
  const me = layout.useLoaderData();
  if (!me.employee) {
    return (
      <>
        <PageHeader title="My profile" description={me.email} />
        <EmptyState
          icon={UserRound}
          title="No employee record has your email yet"
          description={
            me.admin
              ? "Add yourself on the Employees page with this email."
              : "Ask an admin to add you with this email."
          }
        />
      </>
    );
  }
  return (
    <>
      <PageHeader title={me.employee.fullName} description={me.employee.jobTitle || "My profile"} />
      <EmployeeFacts employee={me.employee} />
    </>
  );
}

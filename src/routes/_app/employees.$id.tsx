import { createFileRoute, getRouteApi, notFound } from "@tanstack/react-router";
import { FileText, Pencil } from "lucide-react";
import { useState } from "react";
import { DocumentTable } from "@/client/components/DocumentTable";
import { EmployeeDialog } from "@/client/components/EmployeeDialog";
import { EmployeeFacts } from "@/client/components/EmployeeFacts";
import { EmptyState } from "@/client/components/EmptyState";
import { FormError, Section } from "@/client/components/Form";
import { PageHeader } from "@/client/components/PageHeader";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { useAction } from "@/client/lib/useAction";
import { employeeOptions, getEmployee, setEmployeeStatus } from "@/serverFunctions/hr";

export const Route = createFileRoute("/_app/employees/$id")({
  loader: async ({ params }) => {
    try {
      const [detail, managers] = await Promise.all([getEmployee({ data: { id: params.id } }), employeeOptions()]);
      return { ...detail, managers };
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `${loaderData.employee.fullName} · People & Payroll` }] : [],
  }),
  notFoundComponent: () => <EmptyState kind="filtered" title="No employee here" />,
  component: EmployeePage,
});

const layout = getRouteApi("/_app");

function EmployeePage() {
  const me = layout.useLoaderData();
  const { employee, documents, managers, admin } = Route.useLoaderData();
  const [confirming, setConfirming] = useState(false);
  const { run, error, pending } = useAction();
  const archived = employee.status === "archived";
  return (
    <>
      <PageHeader
        title={employee.fullName}
        description={employee.jobTitle}
        actions={
          admin ? (
            <>
              <EmployeeDialog
                managers={managers.filter((m) => m.status === "active")}
                initial={{
                  id: employee.id,
                  fullName: employee.fullName,
                  email: employee.email,
                  jobTitle: employee.jobTitle,
                  department: employee.department,
                  managerId: employee.managerId,
                  hireDate: employee.hireDate,
                  baseSalary: "baseSalary" in employee ? (employee.baseSalary ?? 0) : 0,
                  allowances: "allowances" in employee ? (employee.allowances ?? 0) : 0,
                }}
                trigger={
                  <Button variant="outline">
                    <Pencil /> Edit
                  </Button>
                }
              />
              {archived ? (
                <Button
                  variant="outline"
                  disabled={pending}
                  onClick={() => run(() => setEmployeeStatus({ data: { id: employee.id, status: "active" } }))}
                >
                  Restore
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setConfirming(true)}>
                  Archive
                </Button>
              )}
            </>
          ) : null
        }
      />
      <FormError error={confirming ? null : error} />
      <EmployeeFacts employee={employee} linkManager={me.admin} />
      <Section title="Documents">
        {documents.length ? (
          <DocumentTable rows={documents} admin={admin} showOwner={false} />
        ) : (
          <EmptyState icon={FileText} title="No documents" size="sm" />
        )}
      </Section>
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive {employee.fullName}?</DialogTitle>
            <DialogDescription>
              Their records stay. They can't request leave or check in, and new payroll runs leave them out.
            </DialogDescription>
          </DialogHeader>
          <FormError error={error} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirming(false)}>
              Keep active
            </Button>
            <Button
              disabled={pending}
              onClick={async () => {
                const done = await run(() => setEmployeeStatus({ data: { id: employee.id, status: "archived" } }));
                if (done) setConfirming(false);
              }}
            >
              Archive employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

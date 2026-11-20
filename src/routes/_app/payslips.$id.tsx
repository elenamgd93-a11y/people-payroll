import { Link, createFileRoute, notFound } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Card, CardContent } from "@/client/components/ui/card";
import { money } from "@/client/lib/format";
import { getPayslip } from "@/serverFunctions/hr";

export const Route = createFileRoute("/_app/payslips/$id")({
  loader: async ({ params }) => {
    try {
      return await getPayslip({ data: { id: params.id } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `Payslip ${loaderData.period} · People & Payroll` }] : [],
  }),
  notFoundComponent: () => <EmptyState kind="filtered" title="No payslip here" />,
  component: Payslip,
});

function Payslip() {
  const slip = Route.useLoaderData();
  const rows: [string, number][] = [
    ["Base salary", slip.baseSalary],
    ["Allowances", slip.allowances],
    [`Unpaid leave (${slip.unpaidDays} days)`, -slip.unpaidDeduction],
    ["Additions", slip.additions],
    ["Deductions", -slip.deductions],
  ];
  return (
    <>
      <PageHeader
        title={`Payslip ${slip.period}`}
        description={slip.employeeName}
        backLink={
          <Link to="/payslips" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden />
            Payslips
          </Link>
        }
      />
      <Card>
        <CardContent className="space-y-2">
          {rows.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="tabular-nums">{money(value)}</span>
            </div>
          ))}
          {slip.note ? <div className="text-sm text-muted-foreground">{slip.note}</div> : null}
          <div className="flex justify-between gap-4 border-t border-border pt-2 font-medium">
            <span>Net pay</span>
            <span className="tabular-nums" data-testid="net-pay">
              {money(slip.netPay)}
            </span>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

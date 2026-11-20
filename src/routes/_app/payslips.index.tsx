import { Link, createFileRoute } from "@tanstack/react-router";
import { ReceiptText } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { money } from "@/client/lib/format";
import { myPayslips } from "@/serverFunctions/hr";

export const Route = createFileRoute("/_app/payslips/")({
  loader: () => myPayslips(),
  head: () => ({ meta: [{ title: "Payslips · People & Payroll" }] }),
  component: Payslips,
});

function Payslips() {
  const slips = Route.useLoaderData();
  return (
    <>
      <PageHeader title="Payslips" />
      {slips.length ? (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Net pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slips.map((s) => (
                <TableRow key={s.id} data-testid="payslip-row">
                  <TableCell>
                    <Link to="/payslips/$id" params={{ id: s.id }} className="font-medium hover:underline">
                      {s.period}
                    </Link>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(s.netPay)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      ) : (
        <EmptyState icon={ReceiptText} title="No payslips yet" description="They appear here once a payroll run is finalized." />
      )}
    </>
  );
}

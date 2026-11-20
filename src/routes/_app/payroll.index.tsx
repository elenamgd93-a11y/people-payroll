import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { Banknote } from "lucide-react";
import { useState, type FormEvent } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { FormError, FormField } from "@/client/components/Form";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Input } from "@/client/components/ui/input";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { RUN_VARIANT, statusLabel } from "@/client/lib/format";
import { useAction } from "@/client/lib/useAction";
import { createRun, listRuns } from "@/serverFunctions/hr";

export const Route = createFileRoute("/_app/payroll/")({
  loader: async () => {
    try {
      return await listRuns();
    } catch {
      throw notFound();
    }
  },
  head: () => ({ meta: [{ title: "Payroll · People & Payroll" }] }),
  notFoundComponent: () => <EmptyState kind="filtered" title="Payroll is for admins" />,
  component: Payroll,
});


function Payroll() {
  const runs = Route.useLoaderData();
  const navigate = useNavigate();
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const { run, error, pending } = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const created = await run(() => createRun({ data: { period } }));
    if (created) await navigate({ to: "/payroll/$runId", params: { runId: created.id } });
  }

  return (
    <>
      <PageHeader title="Payroll" />
      <Card>
        <CardContent>
          <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
            <FormField id="run-period" label="Period">
              <Input id="run-period" type="month" required value={period} onChange={(e) => setPeriod(e.target.value)} />
            </FormField>
            <Button type="submit" disabled={pending}>
              Create run
            </Button>
          </form>
          <div className="mt-3">
            <FormError error={error} />
          </div>
        </CardContent>
      </Card>
      {runs.length ? (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Period</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((r) => (
                <TableRow key={r.id} data-testid="run-row">
                  <TableCell>
                    <Link to="/payroll/$runId" params={{ runId: r.id }} className="font-medium hover:underline">
                      {r.period}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge variant={RUN_VARIANT[r.status]}>{statusLabel(r.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.createdAt.slice(0, 10)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      ) : (
        <EmptyState icon={Banknote} title="No payroll runs yet" />
      )}
    </>
  );
}

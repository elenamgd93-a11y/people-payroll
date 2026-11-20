import { Link, createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { EmptyState } from "@/client/components/EmptyState";
import { FormError, FormField } from "@/client/components/Form";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { RUN_VARIANT, money, statusLabel } from "@/client/lib/format";
import { useAction } from "@/client/lib/useAction";
import { adjustLine, advanceRun, deleteRun, getRun } from "@/serverFunctions/hr";

export const Route = createFileRoute("/_app/payroll/$runId")({
  loader: async ({ params }) => {
    try {
      return await getRun({ data: { id: params.runId } });
    } catch {
      throw notFound();
    }
  },
  head: ({ loaderData }) => ({
    meta: loaderData ? [{ title: `Payroll ${loaderData.run.period} · People & Payroll` }] : [],
  }),
  notFoundComponent: () => <EmptyState kind="filtered" title="No payroll run here" />,
  component: Run,
});

type Line = Awaited<ReturnType<typeof getRun>>["lines"][number];

function Run() {
  const { run, lines, totals } = Route.useLoaderData();
  const navigate = useNavigate();
  const action = useAction();
  const [editing, setEditing] = useState<Line | null>(null);
  const draft = run.status === "draft";

  return (
    <>
      <PageHeader
        title={`Payroll ${run.period}`}
        description={`${lines.length} employees · net ${money(totals.net)}`}
        backLink={
          <Link to="/payroll" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden />
            Payroll
          </Link>
        }
        actions={
          <>
            <Badge variant={RUN_VARIANT[run.status]} data-testid="run-status">
              {statusLabel(run.status)}
            </Badge>
            {draft ? (
              <>
                <Button
                  variant="outline"
                  disabled={action.pending}
                  onClick={async () => {
                    const done = await action.run(() => deleteRun({ data: { id: run.id } }));
                    if (done) await navigate({ to: "/payroll" });
                  }}
                >
                  Delete draft
                </Button>
                <Button
                  disabled={action.pending}
                  onClick={() => action.run(() => advanceRun({ data: { id: run.id, to: "approved" } }))}
                >
                  Approve run
                </Button>
              </>
            ) : run.status === "approved" ? (
              <Button
                disabled={action.pending}
                onClick={() => action.run(() => advanceRun({ data: { id: run.id, to: "finalized" } }))}
              >
                Finalize run
              </Button>
            ) : null}
          </>
        }
      />
      {run.status === "approved" ? (
        <p className="text-sm text-muted-foreground">Finalizing publishes payslips to employees.</p>
      ) : null}
      <FormError error={action.error} />
      {lines.length ? (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead className="text-right">Base</TableHead>
                <TableHead className="text-right">Allowances</TableHead>
                <TableHead className="text-right">Unpaid leave</TableHead>
                <TableHead className="text-right">Additions</TableHead>
                <TableHead className="text-right">Deductions</TableHead>
                <TableHead className="text-right">Net pay</TableHead>
                {draft ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.id} data-testid="payroll-line">
                  <TableCell>
                    <div className="font-medium">{l.employeeName}</div>
                    {l.note ? <div className="text-xs text-muted-foreground">{l.note}</div> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.baseSalary)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.allowances)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <span data-testid="unpaid-deduction">{money(l.unpaidDeduction)}</span>
                    {l.unpaidDays ? <div className="text-xs text-muted-foreground">{l.unpaidDays} days</div> : null}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.additions)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.deductions)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums" data-testid="net-pay">
                    {money(l.netPay)}
                  </TableCell>
                  {draft ? (
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(l)}>
                        Adjust
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell>Total</TableCell>
                <TableCell colSpan={5} />
                <TableCell className="text-right font-medium tabular-nums">{money(totals.net)}</TableCell>
                {draft ? <TableCell /> : null}
              </TableRow>
            </TableFooter>
          </Table>
        </TableCard>
      ) : (
        <EmptyState kind="filtered" title="No active employees in this run" />
      )}
      {editing ? <AdjustDialog line={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

function AdjustDialog({ line, onClose }: { line: Line; onClose: () => void }) {
  const [additions, setAdditions] = useState(String(line.additions));
  const [deductions, setDeductions] = useState(String(line.deductions));
  const [note, setNote] = useState(line.note);
  const { run, error, pending } = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const done = await run(() =>
      adjustLine({
        data: { lineId: line.id, additions: Number(additions || 0), deductions: Number(deductions || 0), note },
      }),
    );
    if (done) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{line.employeeName}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <FormField id="adj-add" label="Additions">
            <Input id="adj-add" type="number" min={0} step="0.01" value={additions} onChange={(e) => setAdditions(e.target.value)} />
          </FormField>
          <FormField id="adj-ded" label="Deductions">
            <Input id="adj-ded" type="number" min={0} step="0.01" value={deductions} onChange={(e) => setDeductions(e.target.value)} />
          </FormField>
          <FormField id="adj-note" label="Note">
            <Input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </FormField>
          <FormError error={error} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

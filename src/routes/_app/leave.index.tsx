import { Link, createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Inbox } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Choice } from "@/client/components/Choice";
import { EmptyState } from "@/client/components/EmptyState";
import { FormError, FormField, Section } from "@/client/components/Form";
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
import { Textarea } from "@/client/components/ui/textarea";
import { statusLabel } from "@/client/lib/format";
import { useAction } from "@/client/lib/useAction";
import { cancelLeave, decideLeave, getLeave, requestLeave } from "@/serverFunctions/hr";

export const Route = createFileRoute("/_app/leave/")({
  loader: () => getLeave(),
  head: () => ({ meta: [{ title: "Leave · People & Payroll" }] }),
  component: Leave,
});

const STATUS_VARIANT = {
  pending: "warning",
  approved: "success",
  rejected: "destructive",
  cancelled: "secondary",
} as const;

function days(n: number) {
  return `${n} ${n === 1 ? "day" : "days"}`;
}

function Leave() {
  const data = Route.useLoaderData();
  const action = useAction();
  return (
    <>
      <PageHeader
        title="Leave"
        actions={
          data.admin ? (
            <Button variant="outline" render={<Link to="/leave/types" />}>
              Leave types
            </Button>
          ) : null
        }
      />
      {data.approvals.length ? (
        <Section title="Waiting for your decision">
          <FormError error={action.error} />
          <div className="grid gap-3">
            {data.approvals.map((r) => (
              <Card key={r.id} data-testid="approval-row">
                <CardContent className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="font-medium">
                      {r.employeeName} · {r.typeName}
                    </div>
                    <div className="text-sm tabular-nums">
                      {r.startDate} to {r.endDate} ({days(r.days)})
                    </div>
                    {r.reason ? <div className="text-sm text-muted-foreground">{r.reason}</div> : null}
                    {r.overlapping.length ? (
                      <div className="text-sm text-muted-foreground">
                        Also away:{" "}
                        {r.overlapping
                          .map((o) => `${o.employeeName} (${o.startDate} to ${o.endDate}, ${o.status})`)
                          .join("; ")}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      disabled={action.pending}
                      onClick={() => action.run(() => decideLeave({ data: { id: r.id, decision: "rejected" } }))}
                    >
                      Reject
                    </Button>
                    <Button
                      disabled={action.pending}
                      onClick={() => action.run(() => decideLeave({ data: { id: r.id, decision: "approved" } }))}
                    >
                      Approve
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>
      ) : null}
      {!data.linked ? (
        <EmptyState icon={CalendarDays} title="No employee record has your email yet" />
      ) : data.types.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="No leave types yet"
          description={data.admin ? "Add one under Leave types." : "An admin has to add leave types first."}
        />
      ) : (
        <>
          <Section title="Balances this year">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.balances.map((b) => (
                <Card key={b.type.id} data-testid="balance">
                  <CardContent className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{b.type.name}</span>
                      {!b.type.paid ? <Badge variant="secondary">Unpaid</Badge> : null}
                    </div>
                    <div className="text-2xl font-semibold tabular-nums">
                      {b.remaining === null ? "Unlimited" : days(b.remaining)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {b.allowance === null
                        ? `${days(b.taken)} taken`
                        : `${b.allowance} + ${b.carryover} carried over − ${b.taken} taken`}
                      {b.pending ? `, ${b.pending} pending` : ""}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Section>
          <RequestForm types={data.types} />
          <Section title="My requests">
            {data.requests.length ? (
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Dates</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.requests.map((r) => (
                      <TableRow key={r.id} data-testid="leave-row">
                        <TableCell>{r.typeName}</TableCell>
                        <TableCell className="tabular-nums">
                          {r.startDate} to {r.endDate}
                        </TableCell>
                        <TableCell className="tabular-nums">{r.days}</TableCell>
                        <TableCell className="max-w-48 truncate">{r.reason}</TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[r.status]}>{statusLabel(r.status)}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {r.status === "pending" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={action.pending}
                              onClick={() => action.run(() => cancelLeave({ data: { id: r.id } }))}
                            >
                              Cancel
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            ) : (
              <EmptyState icon={Inbox} title="No requests yet" size="sm" />
            )}
          </Section>
        </>
      )}
    </>
  );
}

function RequestForm({ types }: { types: { id: string; name: string }[] }) {
  const [typeId, setTypeId] = useState<string | null>(null);
  const [startDate, setStart] = useState("");
  const [endDate, setEnd] = useState("");
  const [reason, setReason] = useState("");
  const { run, error, setError, pending } = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!typeId) {
      setError("Pick a leave type");
      return;
    }
    const done = await run(() => requestLeave({ data: { typeId, startDate, endDate, reason } }));
    if (done) {
      setStart("");
      setEnd("");
      setReason("");
    }
  }

  return (
    <Section title="Request leave">
      <Card>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
            <FormField id="leave-type" label="Leave type">
              <Choice
                id="leave-type"
                testId="leave-type-select"
                placeholder="Choose"
                items={types.map((t) => ({ value: t.id, label: t.name }))}
                value={typeId}
                onChange={setTypeId}
              />
            </FormField>
            <FormField id="leave-from" label="From">
              <Input id="leave-from" type="date" required value={startDate} onChange={(e) => setStart(e.target.value)} />
            </FormField>
            <FormField id="leave-to" label="To">
              <Input id="leave-to" type="date" required value={endDate} onChange={(e) => setEnd(e.target.value)} />
            </FormField>
            <div className="sm:col-span-3">
              <FormField id="leave-reason" label="Reason">
                <Textarea id="leave-reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
              </FormField>
            </div>
            <div className="space-y-3 sm:col-span-3">
              <FormError error={error} />
              <Button type="submit" disabled={pending}>
                Request leave
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Section>
  );
}

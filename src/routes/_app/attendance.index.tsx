import { Link, createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import { Clock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";
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
import { statusLabel } from "@/client/lib/format";
import { useAction } from "@/client/lib/useAction";
import { checkIn, checkOut, decideCorrection, getAttendance, requestCorrection } from "@/serverFunctions/hr";

export const Route = createFileRoute("/_app/attendance/")({
  validateSearch: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: ({ deps }) => getAttendance({ data: deps }),
  head: () => ({ meta: [{ title: "Attendance · People & Payroll" }] }),
  component: Attendance,
});

const layout = getRouteApi("/_app");
const VARIANT = { pending: "warning", approved: "success", rejected: "destructive" } as const;

function Attendance() {
  const me = layout.useLoaderData();
  const data = Route.useLoaderData();
  const navigate = useNavigate({ from: "/attendance/" });
  const action = useAction();
  const today = data.todayRecord;
  const totalHours = Math.round(data.records.reduce((s, r) => s + r.hours, 0) * 10) / 10;

  return (
    <>
      <PageHeader
        title="Attendance"
        actions={
          me.admin || me.isManager ? (
            <Button variant="outline" render={<Link to="/attendance/team" />}>
              Team
            </Button>
          ) : null
        }
      />
      {data.approvals.length ? (
        <Section title="Corrections waiting for you">
          <TableCard>
            <Table>
              <TableBody>
                {data.approvals.map((c) => (
                  <TableRow key={c.id} data-testid="correction-approval">
                    <TableCell className="font-medium">{c.employeeName}</TableCell>
                    <TableCell className="tabular-nums">
                      {c.date} · {c.checkIn}–{c.checkOut ?? "?"}
                    </TableCell>
                    <TableCell className="max-w-64 truncate text-muted-foreground">{c.reason}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={action.pending}
                          onClick={() => action.run(() => decideCorrection({ data: { id: c.id, decision: "rejected" } }))}
                        >
                          Reject
                        </Button>
                        <Button
                          size="sm"
                          disabled={action.pending}
                          onClick={() => action.run(() => decideCorrection({ data: { id: c.id, decision: "approved" } }))}
                        >
                          Approve
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableCard>
        </Section>
      ) : null}
      {!data.linked ? (
        <EmptyState icon={Clock} title="No employee record has your email yet" />
      ) : (
        <>
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div data-testid="today-status" className="space-y-1">
                <div className="text-sm text-muted-foreground">Today, {data.today}</div>
                <div className="font-medium">
                  {!today
                    ? "Not checked in"
                    : today.checkOut
                      ? `Checked out at ${today.checkOut} · ${today.hours.toFixed(1)} h`
                      : `Checked in at ${today.checkIn}`}
                </div>
              </div>
              {!today ? (
                <Button disabled={action.pending} onClick={() => action.run(() => checkIn())}>
                  Check in
                </Button>
              ) : !today.checkOut ? (
                <Button disabled={action.pending} onClick={() => action.run(() => checkOut())}>
                  Check out
                </Button>
              ) : null}
            </CardContent>
          </Card>
          <FormError error={action.error} />
          <Section
            title={`Month of ${data.month}`}
            actions={
              <Input
                type="month"
                aria-label="Month"
                className="w-40"
                value={data.month}
                onChange={(e) => e.target.value && navigate({ search: { month: e.target.value } })}
              />
            }
          >
            {data.records.length ? (
              <TableCard>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>In</TableHead>
                      <TableHead>Out</TableHead>
                      <TableHead className="text-right">Hours</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.records.map((r) => (
                      <TableRow key={r.id} data-testid="attendance-row">
                        <TableCell className="tabular-nums">{r.date}</TableCell>
                        <TableCell className="tabular-nums">{r.checkIn ?? "—"}</TableCell>
                        <TableCell className="tabular-nums">{r.checkOut ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{r.hours.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{r.late ? <Badge variant="warning">Late</Badge> : null}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            ) : (
              <EmptyState icon={Clock} title="No records this month" size="sm" />
            )}
            <div className="text-sm text-muted-foreground">
              {data.records.length} days present · {data.records.filter((r) => r.late).length} late · {totalHours.toFixed(1)} h
            </div>
          </Section>
          <CorrectionForm today={data.today} />
          {data.corrections.length ? (
            <Section title="My corrections">
              <TableCard>
                <Table>
                  <TableBody>
                    {data.corrections.map((c) => (
                      <TableRow key={c.id} data-testid="correction-row">
                        <TableCell className="tabular-nums">{c.date}</TableCell>
                        <TableCell className="tabular-nums">
                          {c.checkIn}–{c.checkOut ?? "?"}
                        </TableCell>
                        <TableCell className="max-w-64 truncate">{c.reason}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={VARIANT[c.status]}>{statusLabel(c.status)}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableCard>
            </Section>
          ) : null}
        </>
      )}
    </>
  );
}

function CorrectionForm({ today }: { today: string }) {
  const [date, setDate] = useState(today);
  const [inAt, setIn] = useState("09:00");
  const [outAt, setOut] = useState("");
  const [reason, setReason] = useState("");
  const { run, error, pending } = useAction();

  async function submit(event: FormEvent) {
    event.preventDefault();
    const done = await run(() =>
      requestCorrection({ data: { date, checkIn: inAt, checkOut: outAt || null, reason } }),
    );
    if (done) setReason("");
  }

  return (
    <Section title="Fix a record">
      <Card>
        <CardContent>
          <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
            <FormField id="fix-date" label="Date">
              <Input id="fix-date" type="date" required max={today} value={date} onChange={(e) => setDate(e.target.value)} />
            </FormField>
            <FormField id="fix-in" label="Check-in time">
              <Input id="fix-in" type="time" required value={inAt} onChange={(e) => setIn(e.target.value)} />
            </FormField>
            <FormField id="fix-out" label="Check-out time">
              <Input id="fix-out" type="time" value={outAt} onChange={(e) => setOut(e.target.value)} />
            </FormField>
            <div className="sm:col-span-3">
              <FormField id="fix-reason" label="Reason">
                <Input id="fix-reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
              </FormField>
            </div>
            <div className="space-y-3 sm:col-span-3">
              <FormError error={error} />
              <Button type="submit" disabled={pending}>
                Request correction
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </Section>
  );
}

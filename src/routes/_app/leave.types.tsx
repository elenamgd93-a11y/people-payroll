import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { useState, type FormEvent } from "react";
import { FormError, FormField, Section } from "@/client/components/Form";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent } from "@/client/components/ui/card";
import { Checkbox } from "@/client/components/ui/checkbox";
import { Input } from "@/client/components/ui/input";
import { Label } from "@/client/components/ui/label";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { useAction } from "@/client/lib/useAction";
import { createLeaveType, getLeaveTypes, updateLeaveType } from "@/serverFunctions/hr";

export const Route = createFileRoute("/_app/leave/types")({
  loader: () => getLeaveTypes(),
  head: () => ({ meta: [{ title: "Leave types · People & Payroll" }] }),
  component: LeaveTypes,
});

interface Draft {
  id?: string;
  name: string;
  allowance: string;
  carryover: string;
  paid: boolean;
}
const blank: Draft = { name: "", allowance: "", carryover: "0", paid: true };

function LeaveTypes() {
  const { admin, types } = Route.useLoaderData();
  const [draft, setDraft] = useState<Draft>(blank);
  const { run, error, pending } = useAction();
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  async function submit(event: FormEvent) {
    event.preventDefault();
    const data = {
      name: draft.name,
      allowanceDays: draft.allowance.trim() === "" ? null : Number(draft.allowance),
      carryoverCap: Number(draft.carryover || 0),
      paid: draft.paid,
    };
    const done = await run(() =>
      draft.id ? updateLeaveType({ data: { id: draft.id, ...data } }) : createLeaveType({ data }),
    );
    if (done) setDraft(blank);
  }

  return (
    <>
      <PageHeader
        title="Leave types"
        backLink={
          <Link to="/leave" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden />
            Leave
          </Link>
        }
      />
      {types.length ? (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Days per year</TableHead>
                <TableHead>Carryover cap</TableHead>
                <TableHead>Pay</TableHead>
                {admin ? <TableHead /> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((t) => (
                <TableRow key={t.id} data-testid="leave-type-row">
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="tabular-nums">{t.allowanceDays ?? "Unlimited"}</TableCell>
                  <TableCell className="tabular-nums">{t.carryoverCap}</TableCell>
                  <TableCell>
                    <Badge variant={t.paid ? "success" : "secondary"}>{t.paid ? "Paid" : "Unpaid"}</Badge>
                  </TableCell>
                  {admin ? (
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          setDraft({
                            id: t.id,
                            name: t.name,
                            allowance: t.allowanceDays === null ? "" : String(t.allowanceDays),
                            carryover: String(t.carryoverCap),
                            paid: t.paid,
                          })
                        }
                      >
                        Edit
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      ) : null}
      {admin ? (
        <Section title={draft.id ? `Edit ${draft.name || "leave type"}` : "New leave type"}>
          <Card>
            <CardContent>
              <form onSubmit={submit} className="grid gap-3 sm:grid-cols-3">
                <FormField id="lt-name" label="Name">
                  <Input id="lt-name" required value={draft.name} onChange={(e) => set({ name: e.target.value })} />
                </FormField>
                <FormField id="lt-days" label="Days per year">
                  <Input
                    id="lt-days"
                    type="number"
                    min={0}
                    placeholder="Unlimited"
                    value={draft.allowance}
                    onChange={(e) => set({ allowance: e.target.value })}
                  />
                </FormField>
                <FormField id="lt-carry" label="Carryover cap">
                  <Input
                    id="lt-carry"
                    type="number"
                    min={0}
                    value={draft.carryover}
                    onChange={(e) => set({ carryover: e.target.value })}
                  />
                </FormField>
                <div className="flex items-center gap-2 sm:col-span-3">
                  <Checkbox id="lt-paid" checked={draft.paid} onCheckedChange={(v) => set({ paid: v === true })} />
                  <Label htmlFor="lt-paid">Paid</Label>
                </div>
                <div className="space-y-3 sm:col-span-3">
                  <FormError error={error} />
                  <div className="flex gap-2">
                    <Button type="submit" disabled={pending}>
                      {draft.id ? "Save leave type" : "Add leave type"}
                    </Button>
                    {draft.id ? (
                      <Button type="button" variant="outline" onClick={() => setDraft(blank)}>
                        Cancel
                      </Button>
                    ) : null}
                  </div>
                </div>
              </form>
            </CardContent>
          </Card>
        </Section>
      ) : null}
    </>
  );
}

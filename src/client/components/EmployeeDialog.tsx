import { useState, type FormEvent, type ReactElement } from "react";
import { Choice } from "@/client/components/Choice";
import { FormError, FormField } from "@/client/components/Form";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/client/components/ui/dialog";
import { Input } from "@/client/components/ui/input";
import { useAction } from "@/client/lib/useAction";
import { saveEmployee } from "@/serverFunctions/hr";

const NONE = "none";

export interface EmployeeDraft {
  id?: string;
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  managerId: string | null;
  hireDate: string;
  baseSalary: number;
  allowances: number;
}

export function EmployeeDialog({
  trigger,
  initial,
  managers,
}: {
  trigger: ReactElement;
  initial?: EmployeeDraft;
  managers: { id: string; fullName: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<EmployeeDraft>(initial ?? blank());
  const { run, error, setError, pending } = useAction();
  const set = (patch: Partial<EmployeeDraft>) => setForm((f) => ({ ...f, ...patch }));
  const items = [
    { value: NONE, label: "No manager" },
    ...managers.filter((m) => m.id !== form.id).map((m) => ({ value: m.id, label: m.fullName })),
  ];

  async function submit(event: FormEvent) {
    event.preventDefault();
    const saved = await run(() => saveEmployee({ data: form }));
    if (saved) {
      setOpen(false);
      if (!initial) setForm(blank());
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
        if (next) setForm(initial ?? blank());
      }}
    >
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit employee" : "Add employee"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
          <FormField id="emp-name" label="Full name">
            <Input id="emp-name" required value={form.fullName} onChange={(e) => set({ fullName: e.target.value })} />
          </FormField>
          <FormField id="emp-email" label="Work email">
            <Input id="emp-email" type="email" required value={form.email} onChange={(e) => set({ email: e.target.value })} />
          </FormField>
          <FormField id="emp-title" label="Job title">
            <Input id="emp-title" value={form.jobTitle} onChange={(e) => set({ jobTitle: e.target.value })} />
          </FormField>
          <FormField id="emp-dept" label="Department">
            <Input id="emp-dept" value={form.department} onChange={(e) => set({ department: e.target.value })} />
          </FormField>
          <FormField id="emp-manager" label="Manager">
            <Choice
              id="emp-manager"
              testId="manager-select"
              items={items}
              value={form.managerId ?? NONE}
              onChange={(v) => set({ managerId: v === NONE ? null : v })}
            />
          </FormField>
          <FormField id="emp-hired" label="Hire date">
            <Input id="emp-hired" type="date" required value={form.hireDate} onChange={(e) => set({ hireDate: e.target.value })} />
          </FormField>
          <FormField id="emp-base" label="Base monthly salary">
            <Input
              id="emp-base"
              type="number"
              min={0}
              step="0.01"
              required
              value={String(form.baseSalary)}
              onChange={(e) => set({ baseSalary: Number(e.target.value) })}
            />
          </FormField>
          <FormField id="emp-allow" label="Allowances">
            <Input
              id="emp-allow"
              type="number"
              min={0}
              step="0.01"
              value={String(form.allowances)}
              onChange={(e) => set({ allowances: Number(e.target.value) })}
            />
          </FormField>
          <div className="sm:col-span-2">
            <FormError error={error} />
          </div>
          <DialogFooter className="sm:col-span-2">
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function blank(): EmployeeDraft {
  return {
    fullName: "",
    email: "",
    jobTitle: "",
    department: "",
    managerId: null,
    hireDate: new Date().toISOString().slice(0, 10),
    baseSalary: 0,
    allowances: 0,
  };
}

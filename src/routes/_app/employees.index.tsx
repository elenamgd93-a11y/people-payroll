import { Link, createFileRoute, getRouteApi, useNavigate } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Plus, Users } from "lucide-react";
import { useState } from "react";
import { z } from "zod";
import { Choice } from "@/client/components/Choice";
import { EmployeeDialog } from "@/client/components/EmployeeDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
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
import { wholeMoney } from "@/client/lib/format";
import { employeeOptions, listEmployees } from "@/serverFunctions/hr";

const search = z.object({
  q: z.string().optional().catch(undefined),
  department: z.string().optional().catch(undefined),
  status: z.enum(["active", "archived", "all"]).optional().catch(undefined),
  sort: z.enum(["name", "department", "hireDate", "jobTitle"]).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
  page: z.coerce.number().int().min(1).optional().catch(undefined),
});
type Search = z.infer<typeof search>;

export const Route = createFileRoute("/_app/employees/")({
  validateSearch: search,
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const [list, managers] = await Promise.all([listEmployees({ data: deps }), employeeOptions()]);
    return { list, managers };
  },
  head: () => ({ meta: [{ title: "Employees · People & Payroll" }] }),
  component: Employees,
});

const layout = getRouteApi("/_app");
const ALL = "all";

function Employees() {
  const me = layout.useLoaderData();
  const { list, managers } = Route.useLoaderData();
  const params = Route.useSearch();
  const navigate = useNavigate({ from: "/employees/" });
  const [q, setQ] = useState(params.q ?? "");
  const go = (patch: Partial<Search>) =>
    navigate({ search: (prev) => ({ ...prev, page: undefined, ...patch }) });
  const sort = params.sort ?? "name";
  const dir = params.dir ?? "asc";
  const pages = Math.max(1, Math.ceil(list.total / list.pageSize));
  const filtered = !!(params.q || params.department || (params.status && params.status !== "active"));

  function SortHead({ column, label }: { column: NonNullable<Search["sort"]>; label: string }) {
    const active = sort === column;
    return (
      <TableHead>
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-foreground"
          onClick={() => go({ sort: column, dir: active && dir === "asc" ? "desc" : "asc" })}
        >
          {label}
          {active ? dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
        </button>
      </TableHead>
    );
  }

  return (
    <>
      <PageHeader
        title="Employees"
        description={me.admin ? `${list.total} shown` : "You and your direct reports"}
        actions={
          me.admin ? (
            <EmployeeDialog
              managers={managers.filter((m) => m.status === "active")}
              trigger={
                <Button data-testid="add-employee">
                  <Plus /> Add employee
                </Button>
              }
            />
          ) : null
        }
      />
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="min-w-48 flex-1"
          onSubmit={(e) => {
            e.preventDefault();
            go({ q: q.trim() || undefined });
          }}
        >
          <Input
            type="search"
            placeholder="Search name, email or title"
            aria-label="Search"
            data-testid="employee-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>
        <Choice
          testId="department-filter"
          label="Department"
          className="w-44"
          items={[{ value: ALL, label: "All departments" }, ...list.departments.map((d) => ({ value: d, label: d }))]}
          value={params.department ?? ALL}
          onChange={(v) => go({ department: v === ALL ? undefined : v })}
        />
        <Choice
          testId="status-filter"
          label="Status"
          className="w-36"
          items={[
            { value: "active", label: "Active" },
            { value: "archived", label: "Archived" },
            { value: "all", label: "All statuses" },
          ]}
          value={params.status ?? "active"}
          onChange={(v) => go({ status: v === "active" ? undefined : (v as Search["status"]) })}
        />
      </div>
      {list.rows.length === 0 ? (
        <EmptyState
          kind={filtered ? "filtered" : "no-data"}
          icon={filtered ? undefined : Users}
          title={filtered ? "No employees match" : "No employees yet"}
        />
      ) : (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <SortHead column="name" label="Name" />
                <SortHead column="jobTitle" label="Job title" />
                <SortHead column="department" label="Department" />
                <TableHead>Manager</TableHead>
                <SortHead column="hireDate" label="Hired" />
                {me.admin ? <TableHead className="text-right">Monthly pay</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.rows.map((e) => (
                <TableRow key={e.id} data-testid="employee-row">
                  <TableCell>
                    <Link to="/employees/$id" params={{ id: e.id }} className="font-medium hover:underline">
                      {e.fullName}
                    </Link>
                    {e.status === "archived" ? (
                      <Badge variant="secondary" className="ml-2">
                        Archived
                      </Badge>
                    ) : null}
                    <div className="text-xs text-muted-foreground">{e.email}</div>
                  </TableCell>
                  <TableCell>{e.jobTitle}</TableCell>
                  <TableCell>{e.department}</TableCell>
                  <TableCell>{e.managerName ?? "—"}</TableCell>
                  <TableCell>{e.hireDate}</TableCell>
                  {me.admin && "baseSalary" in e ? (
                    <TableCell className="text-right tabular-nums">
                      {wholeMoney((e.baseSalary ?? 0) + (e.allowances ?? 0))}
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      )}
      {pages > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
          <span>
            Page {list.page} of {pages}
          </span>
          <Button variant="outline" size="sm" disabled={list.page <= 1} onClick={() => go({ page: list.page - 1 })}>
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={list.page >= pages}
            onClick={() => navigate({ search: (prev) => ({ ...prev, page: list.page + 1 }) })}
          >
            Next
          </Button>
        </div>
      ) : null}
    </>
  );
}

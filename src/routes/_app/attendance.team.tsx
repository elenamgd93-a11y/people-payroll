import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { ChevronLeft, Users } from "lucide-react";
import { z } from "zod";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
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
import { getTeamAttendance } from "@/serverFunctions/hr";

export const Route = createFileRoute("/_app/attendance/team")({
  validateSearch: z.object({ month: z.string().regex(/^\d{4}-\d{2}$/).optional().catch(undefined) }),
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: ({ deps }) => getTeamAttendance({ data: deps }),
  head: () => ({ meta: [{ title: "Team attendance · People & Payroll" }] }),
  component: TeamAttendance,
});

function TeamAttendance() {
  const data = Route.useLoaderData();
  const navigate = useNavigate({ from: "/attendance/team" });
  return (
    <>
      <PageHeader
        title="Team attendance"
        backLink={
          <Link to="/attendance" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="size-4" aria-hidden />
            Attendance
          </Link>
        }
        actions={
          <Input
            type="month"
            aria-label="Month"
            className="w-40"
            value={data.month}
            onChange={(e) => e.target.value && navigate({ search: { month: e.target.value } })}
          />
        }
      />
      {data.rows.length ? (
        <TableCard>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Employee</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="text-right">Days present</TableHead>
                <TableHead className="text-right">Late days</TableHead>
                <TableHead className="text-right">Hours</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.map((r) => (
                <TableRow key={r.id} data-testid="team-row">
                  <TableCell className="font-medium">{r.fullName}</TableCell>
                  <TableCell>{r.department}</TableCell>
                  <TableCell className="text-right tabular-nums" data-testid="days-present">
                    {r.daysPresent}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" data-testid="late-days">
                    {r.lateDays}
                  </TableCell>
                  <TableCell className="text-right tabular-nums" data-testid="hours">
                    {r.hours.toFixed(1)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      ) : (
        <EmptyState icon={Users} title={data.allowed ? "No active employees" : "Nobody reports to you"} />
      )}
    </>
  );
}

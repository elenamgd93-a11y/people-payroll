import { Link } from "@tanstack/react-router";
import { Badge } from "@/client/components/ui/badge";
import { Card, CardContent } from "@/client/components/ui/card";
import { wholeMoney } from "@/client/lib/format";

interface Employee {
  id: string;
  fullName: string;
  email: string;
  jobTitle: string;
  department: string;
  managerId: string | null;
  managerName: string | null;
  hireDate: string;
  status: "active" | "archived";
  baseSalary?: number;
  allowances?: number;
}

export function EmployeeFacts({ employee, linkManager }: { employee: Employee; linkManager?: boolean }) {
  const rows: [string, React.ReactNode, string?][] = [
    ["Work email", employee.email],
    ["Department", employee.department || "—"],
    [
      "Manager",
      employee.managerName && employee.managerId && linkManager ? (
        <Link to="/employees/$id" params={{ id: employee.managerId }} className="hover:underline">
          {employee.managerName}
        </Link>
      ) : (
        employee.managerName ?? "—"
      ),
      "manager",
    ],
    ["Hire date", employee.hireDate],
    [
      "Status",
      <Badge variant={employee.status === "active" ? "success" : "secondary"} data-testid="employee-status">
        {employee.status === "active" ? "Active" : "Archived"}
      </Badge>,
    ],
  ];
  if (employee.baseSalary !== undefined) {
    rows.push(["Base monthly salary", wholeMoney(employee.baseSalary), "salary"]);
    rows.push(["Allowances", wholeMoney(employee.allowances ?? 0), "allowances"]);
  }
  return (
    <Card>
      <CardContent>
        <dl className="grid gap-4 sm:grid-cols-2">
          {rows.map(([label, value, testId]) => (
            <div key={label} className="space-y-1">
              <dt className="text-xs text-muted-foreground">{label}</dt>
              <dd className="text-sm" data-testid={testId}>
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
}

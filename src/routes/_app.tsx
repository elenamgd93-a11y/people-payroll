import { Link, Outlet, createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { getMe } from "@/serverFunctions/hr";

export const Route = createFileRoute("/_app")({
  loader: () => getMe(),
  component: AppLayout,
});

const LINK =
  "shrink-0 text-sm text-muted-foreground transition-colors hover:text-foreground";

function AppLayout() {
  const me = Route.useLoaderData();
  const links = [
    { to: "/", label: "Profile" },
    { to: "/employees", label: "Employees" },
    { to: "/documents", label: "Documents" },
    { to: "/leave", label: "Leave" },
    { to: "/attendance", label: "Attendance" },
    ...(me.admin ? [{ to: "/payroll", label: "Payroll" }] : []),
    { to: "/payslips", label: "Payslips" },
  ] as const;
  return (
    <AppShell
      nav={
        <nav className="flex min-w-0 items-center gap-4 overflow-x-auto">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={LINK}
              activeOptions={{ exact: link.to === "/" }}
              activeProps={{ className: "font-medium text-foreground" }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      }
    >
      <Outlet />
    </AppShell>
  );
}

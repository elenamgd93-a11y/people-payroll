# People & Payroll

Keep employee records and documents, handle leave and attendance, and run monthly payroll for a small company. Admins manage the records; every employee sees their own profile, balances, attendance and payslips.

Inspired by https://bayzat.com

Built with [oss.new](https://oss.new) for [EveryApp](https://github.com/every-app/every-app).

## Features

- Keep an employee directory with managers, salaries and allowances, and search, filter, sort and archive it.
- Upload employee and company documents and see which have expired or expire within 30 days.
- Define leave types, request leave against a yearly balance, and have managers approve it with the team's overlaps in view.
- Check in and out from the browser, see the month's hours and late days, and request corrections.
- Create monthly payroll runs with unpaid-leave deductions and one-off adjustments, approve and finalize them, and read payslips.

Left out: accounts and sign-in, which your Gateway handles; paying salaries and bank files; insurance and benefits; hiring, reviews and learning; shift scheduling and onboarding checklists; mobile, kiosk and biometric check-ins.

## Setup

```sh
pnpm install
pnpm dev            # run locally behind a local Gateway
pnpm types:check
pnpm run deploy     # deploy to your Cloudflare account through your Gateway
```

The deploy creates a D1 database and an R2 bucket (R2 must be enabled on the Cloudflare account once). One setting, filled in with its default:

- `TIME_ZONE` (default `UTC`): the company's time zone, which decides the day a check-in counts for and whether it is late.

The end-to-end checks in `checks/` run against a packed release with the oss.new runtime.

## Limitations

- Each person is linked to their employee record by work email, so an admin adds the record with the email they sign in with.
- Check-ins after 09:00 local time are late; the workday start is fixed.
- Leave counts calendar days, and a request can't span two years.
- Payroll uses one currency and divides base salary by 30 for each unpaid-leave day. Paying salaries is done outside the app.
- Files can be up to 10 MB.

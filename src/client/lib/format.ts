export function money(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function wholeMoney(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  passport: "Passport",
  visa: "Visa",
  id: "ID card",
  contract: "Contract",
  trade_licence: "Trade licence",
  other: "Other",
};

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    try {
      const issues = JSON.parse(error.message) as { message?: string }[];
      if (Array.isArray(issues) && issues[0]?.message) return issues[0].message;
    } catch {
      // a plain message
    }
    return error.message;
  }
  return "Something went wrong";
}

export function statusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
export const RUN_VARIANT = { draft: "secondary", approved: "info", finalized: "success" } as const;

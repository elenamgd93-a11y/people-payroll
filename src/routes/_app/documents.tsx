import { createFileRoute } from "@tanstack/react-router";
import { FileText, Upload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Choice } from "@/client/components/Choice";
import { DocumentTable } from "@/client/components/DocumentTable";
import { EmptyState } from "@/client/components/EmptyState";
import { FormError, FormField } from "@/client/components/Form";
import { PageHeader } from "@/client/components/PageHeader";
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
import { DOCUMENT_TYPE_LABELS } from "@/client/lib/format";
import { useAction } from "@/client/lib/useAction";
import { listDocuments } from "@/serverFunctions/hr";

export const Route = createFileRoute("/_app/documents")({
  loader: () => listDocuments(),
  head: () => ({ meta: [{ title: "Documents · People & Payroll" }] }),
  component: Documents,
});

function Documents() {
  const { admin, documents, owners } = Route.useLoaderData();
  const flagged = documents.filter((d) => d.expiry === "expired" || d.expiry === "soon").length;
  return (
    <>
      <PageHeader
        title="Documents"
        description={flagged ? `${flagged} expired or expiring within 30 days` : undefined}
        actions={admin ? <UploadDialog owners={owners.filter((o) => o.status === "active")} /> : null}
      />
      {documents.length ? (
        <DocumentTable rows={documents} admin={admin} showOwner={admin} />
      ) : (
        <EmptyState icon={FileText} title="No documents yet" />
      )}
    </>
  );
}

function UploadDialog({ owners }: { owners: { id: string; fullName: string }[] }) {
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState<string | null>(null);
  const [type, setType] = useState<string | null>(null);
  const { run, error, setError, pending } = useAction();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!owner || !type) {
      setError("Choose who it belongs to and its type");
      return;
    }
    const form = new FormData(event.currentTarget);
    form.set("employeeId", owner);
    form.set("type", type);
    const done = await run(async () => {
      const response = await fetch("/api/documents", { method: "POST", body: form });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "The upload failed");
      }
      return true;
    });
    if (done) {
      setOpen(false);
      setOwner(null);
      setType(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button>
            <Upload /> Upload document
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Upload document</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-3">
          <FormField id="doc-owner" label="Belongs to">
            <Choice
              id="doc-owner"
              testId="doc-owner-select"
              placeholder="Choose"
              items={[{ value: "company", label: "Company" }, ...owners.map((o) => ({ value: o.id, label: o.fullName }))]}
              value={owner}
              onChange={setOwner}
            />
          </FormField>
          <FormField id="doc-type" label="Type">
            <Choice
              id="doc-type"
              testId="doc-type-select"
              placeholder="Choose"
              items={Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => ({ value, label }))}
              value={type}
              onChange={setType}
            />
          </FormField>
          <FormField id="doc-number" label="Document number">
            <Input id="doc-number" name="number" />
          </FormField>
          <FormField id="doc-expires" label="Expires on">
            <Input id="doc-expires" name="expiresOn" type="date" />
          </FormField>
          <FormField id="doc-file" label="File">
            <Input id="doc-file" name="file" type="file" required data-testid="doc-file" />
          </FormField>
          <FormError error={error} />
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

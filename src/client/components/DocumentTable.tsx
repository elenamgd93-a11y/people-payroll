import { Trash2 } from "lucide-react";
import { useState } from "react";
import { FormError } from "@/client/components/Form";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/client/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCard,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/client/components/ui/table";
import { DOCUMENT_TYPE_LABELS } from "@/client/lib/format";
import { useAction } from "@/client/lib/useAction";
import { deleteDocument } from "@/serverFunctions/hr";

export interface DocumentRow {
  id: string;
  employeeId: string | null;
  employeeName: string | null;
  type: string;
  number: string;
  expiresOn: string | null;
  fileName: string;
  expiry: "none" | "expired" | "soon" | "valid";
}

export function ExpiryBadge({ expiry }: { expiry: DocumentRow["expiry"] }) {
  if (expiry === "expired") return <Badge variant="destructive">Expired</Badge>;
  if (expiry === "soon") return <Badge variant="warning">Expires soon</Badge>;
  return null;
}

export function DocumentTable({
  rows,
  admin,
  showOwner,
}: {
  rows: DocumentRow[];
  admin: boolean;
  showOwner: boolean;
}) {
  const [deleting, setDeleting] = useState<DocumentRow | null>(null);
  const { run, error, setError, pending } = useAction();
  return (
    <>
      <TableCard>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Document</TableHead>
              {showOwner ? <TableHead>Belongs to</TableHead> : null}
              <TableHead>Number</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((doc) => (
              <TableRow key={doc.id} data-testid="doc-row">
                <TableCell>
                  <div className="font-medium">{DOCUMENT_TYPE_LABELS[doc.type] ?? doc.type}</div>
                  <div className="text-xs text-muted-foreground">{doc.fileName}</div>
                </TableCell>
                {showOwner ? <TableCell>{doc.employeeName ?? "Company"}</TableCell> : null}
                <TableCell className="tabular-nums">{doc.number || "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="tabular-nums">{doc.expiresOn ?? "—"}</span>
                    <ExpiryBadge expiry={doc.expiry} />
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="sm" render={<a href={`/api/documents/${doc.id}/file`} />}>
                      Download
                    </Button>
                    {admin ? (
                      <Button variant="ghost" size="sm" aria-label="Delete" onClick={() => setDeleting(doc)}>
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableCard>
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open) {
            setDeleting(null);
            setError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this document?</DialogTitle>
            <DialogDescription>The file is deleted too.</DialogDescription>
          </DialogHeader>
          <FormError error={error} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              Keep
            </Button>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={async () => {
                if (!deleting) return;
                const done = await run(() => deleteDocument({ data: { id: deleting.id } }));
                if (done) setDeleting(null);
              }}
            >
              Delete document
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

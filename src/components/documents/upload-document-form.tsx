"use client";

import { useActionState } from "react";
import { uploadDocumentAction } from "@/lib/documents/actions";
import { Field, FormError, Select, SubmitButton, TextInput } from "@/components/ui/form";
import { DOCUMENT_TYPE_LABELS } from "@/lib/labels";
import { ALLOWED_DOCUMENT_EXTENSIONS } from "@/lib/documents/validation";

export function UploadDocumentForm({ transactionId }: { transactionId: string }) {
  const [state, formAction, pending] = useActionState(uploadDocumentAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-4 p-5" encType="multipart/form-data">
      <input type="hidden" name="transactionId" value={transactionId} />

      <Field label="File" htmlFor="file" hint="PDF, Word, or image — up to 15 MB">
        <TextInput id="file" name="file" type="file" accept={ALLOWED_DOCUMENT_EXTENSIONS} required />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Document type" htmlFor="documentType">
          <Select id="documentType" name="documentType" defaultValue="OTHER" required>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Description" htmlFor="description" hint="Optional">
          <TextInput id="description" name="description" />
        </Field>
      </div>

      <FormError message={state?.error} />

      <SubmitButton pending={pending} pendingLabel="Uploading…">
        Upload document
      </SubmitButton>
    </form>
  );
}

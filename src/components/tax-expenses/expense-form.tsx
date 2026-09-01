"use client";

import { useActionState } from "react";
import { createExpenseAction, updateExpenseAction } from "@/lib/tax-expenses/actions";
import { Field, FormError, Select, SubmitButton, TextArea, TextInput } from "@/components/ui/form";
import { PAYMENT_METHOD_LABELS, DEDUCTIBILITY_STATUS_LABELS } from "@/lib/labels";
import { toDateInputValue, contactDisplayName } from "@/lib/format";
import { ALLOWED_DOCUMENT_EXTENSIONS } from "@/lib/documents/validation";

interface ExpenseFormProps {
  categories: { id: string; name: string }[];
  transactions: { id: string; propertyAddress: string | null }[];
  contacts: { id: string; firstName: string; lastName: string }[];
  expense?: {
    id: string;
    expenseDate: Date;
    amount: string;
    vendor: string;
    categoryId: string;
    businessPurpose: string | null;
    paymentMethod: string;
    deductibleStatus: string;
    businessUsePercent: number | null;
    notes: string | null;
    transactionId: string | null;
    contactId: string | null;
  };
}

/** Shared create/edit form. Receipt upload only appears on create — see createExpenseAction's comment for why (one combined submission, matching uploadDocumentAction's pattern); editing an existing expense's receipts happens via the separate attach/remove receipt forms on the edit page. */
export function ExpenseForm({ categories, transactions, contacts, expense }: ExpenseFormProps) {
  const isEdit = Boolean(expense);
  const [state, formAction, pending] = useActionState(isEdit ? updateExpenseAction : createExpenseAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      {isEdit ? <input type="hidden" name="expenseId" value={expense!.id} /> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="expenseDate">
          <TextInput
            id="expenseDate"
            name="expenseDate"
            type="date"
            required
            defaultValue={toDateInputValue(expense?.expenseDate)}
            autoFocus
          />
        </Field>
        <Field label="Amount" htmlFor="amount">
          <TextInput
            id="amount"
            name="amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            required
            defaultValue={expense?.amount}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Vendor / payee" htmlFor="vendor">
          <TextInput id="vendor" name="vendor" required defaultValue={expense?.vendor} />
        </Field>
        <Field label="Category" htmlFor="categoryId">
          <Select id="categoryId" name="categoryId" required defaultValue={expense?.categoryId ?? ""}>
            <option value="" disabled>
              Choose a category
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Business purpose" htmlFor="businessPurpose" hint="Optional">
        <TextInput id="businessPurpose" name="businessPurpose" defaultValue={expense?.businessPurpose ?? ""} />
      </Field>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Payment method" htmlFor="paymentMethod">
          <Select id="paymentMethod" name="paymentMethod" defaultValue={expense?.paymentMethod ?? "OTHER"}>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Status" htmlFor="deductibleStatus" hint="You (or your tax pro) decide this — never assumed">
          <Select id="deductibleStatus" name="deductibleStatus" defaultValue={expense?.deductibleStatus ?? "NEEDS_REVIEW"}>
            {Object.entries(DEDUCTIBILITY_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Business use %" htmlFor="businessUsePercent" hint="Optional — for mixed-use expenses">
          <TextInput
            id="businessUsePercent"
            name="businessUsePercent"
            type="number"
            min={0}
            max={100}
            placeholder="e.g. 50"
            defaultValue={expense?.businessUsePercent ?? ""}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Transaction" htmlFor="transactionId" hint="Optional">
          <Select id="transactionId" name="transactionId" defaultValue={expense?.transactionId ?? ""}>
            <option value="">None</option>
            {transactions.map((transaction) => (
              <option key={transaction.id} value={transaction.id}>
                {transaction.propertyAddress ?? "Untitled transaction"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Client / contact" htmlFor="contactId" hint="Optional">
          <Select id="contactId" name="contactId" defaultValue={expense?.contactId ?? ""}>
            <option value="">None</option>
            {contacts.map((contact) => (
              <option key={contact.id} value={contact.id}>
                {contactDisplayName(contact)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="Notes" htmlFor="notes" hint="Optional">
        <TextArea id="notes" name="notes" rows={3} defaultValue={expense?.notes ?? ""} />
      </Field>

      {!isEdit ? (
        <Field label="Receipt" htmlFor="receipt" hint="Optional — PDF, Word document, or image, up to 15 MB">
          <TextInput id="receipt" name="receipt" type="file" accept={ALLOWED_DOCUMENT_EXTENSIONS} />
        </Field>
      ) : null}

      <FormError message={state?.error} />

      <SubmitButton pending={pending} pendingLabel="Saving…">
        {isEdit ? "Save changes" : "Add expense"}
      </SubmitButton>
    </form>
  );
}

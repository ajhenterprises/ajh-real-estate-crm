import type { ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

const fieldClassName =
  "rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-accent disabled:opacity-60";

export function Field({
  label,
  htmlFor,
  children,
  hint,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${fieldClassName} ${props.className ?? ""}`} />;
}

export function TextArea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${fieldClassName} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${fieldClassName} ${props.className ?? ""}`} />;
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-md bg-status-attention-bg px-3 py-2 text-sm text-status-attention">
      {message}
    </p>
  );
}

export function SubmitButton({
  children,
  pending,
  pendingLabel,
}: {
  children: ReactNode;
  pending: boolean;
  pendingLabel: string;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="mt-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

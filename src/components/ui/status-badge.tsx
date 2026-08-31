const VARIANTS = {
  attention: {
    label: "Needs attention",
    className: "bg-status-attention-bg text-status-attention",
  },
  upcoming: {
    label: "Upcoming",
    className: "bg-status-upcoming-bg text-status-upcoming",
  },
  "on-track": {
    label: "On track",
    className: "bg-status-ontrack-bg text-status-ontrack",
  },
} as const;

export type StatusVariant = keyof typeof VARIANTS;

export function StatusBadge({
  variant,
  label,
}: {
  variant: StatusVariant;
  label?: string;
}) {
  const { label: defaultLabel, className } = VARIANTS[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label ?? defaultLabel}
    </span>
  );
}

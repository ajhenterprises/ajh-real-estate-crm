import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { getCalendarMonthItems, type CalendarItem } from "@/lib/repos/calendar";
import { Card } from "@/components/ui/card";
import { TASK_PRIORITY_LABELS, TRANSACTION_EVENT_TYPE_LABELS } from "@/lib/labels";
import { formatTime } from "@/lib/format";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

function parseMonthParam(value: string | undefined, now: Date): { year: number; month: number } {
  if (value && /^\d{4}-\d{2}$/.test(value)) {
    const [year, month] = value.split("-").map(Number);
    if (month >= 1 && month <= 12) return { year, month };
  }
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const total = year * 12 + (month - 1) + delta;
  return { year: Math.floor(total / 12), month: (((total % 12) + 12) % 12) + 1 };
}

function monthParam(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Every cell the grid needs to render, including the leading/trailing days from adjacent months that complete each week row. */
function buildGridDays(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const startWeekday = firstOfMonth.getUTCDay();
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ date: new Date(Date.UTC(year, month - 1, 1 - (startWeekday - i))), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(Date.UTC(year, month - 1, day)), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate() + 1)), inMonth: false });
  }
  return cells;
}

function dayKeyUTC(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function itemHref(item: CalendarItem): string {
  if (item.kind === "task") return `/tasks/${item.id}`;
  if (item.kind === "showing") return `/showings/${item.id}`;
  return `/transactions/${item.transactionId}`;
}

function itemLabel(item: CalendarItem): string {
  if (item.kind === "task") {
    return `${item.title}${item.priority === "URGENT" || item.priority === "HIGH" ? ` (${TASK_PRIORITY_LABELS[item.priority as keyof typeof TASK_PRIORITY_LABELS]})` : ""}`;
  }
  if (item.kind === "showing") {
    return `${formatTime(item.date)} — ${item.title}`;
  }
  return item.propertyAddress ? `${TRANSACTION_EVENT_TYPE_LABELS[item.eventType as keyof typeof TRANSACTION_EVENT_TYPE_LABELS]} — ${item.propertyAddress}` : item.title;
}

export default async function CalendarPage(props: PageProps<"/calendar">) {
  const session = await requireSession();
  const searchParams = await props.searchParams;

  const now = new Date();
  const monthParamValue = typeof searchParams.month === "string" ? searchParams.month : undefined;
  const { year, month } = parseMonthParam(monthParamValue, now);

  const itemsByDay = await getCalendarMonthItems(session.user.id, year, month);
  const gridDays = buildGridDays(year, month);

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);
  const todayKey = dayKeyUTC(now);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Task due dates and transaction deadlines, in one place.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${monthParam(prev.year, prev.month)}`}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            ← Previous
          </Link>
          <span className="min-w-[10rem] text-center text-sm font-semibold text-foreground">
            {MONTH_LABELS[month - 1]} {year}
          </span>
          <Link
            href={`/calendar?month=${monthParam(next.year, next.month)}`}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Next →
          </Link>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {gridDays.map(({ date, inMonth }) => {
            const key = dayKeyUTC(date);
            const items = itemsByDay.get(key) ?? [];
            const isToday = key === todayKey;
            const visibleItems = items.slice(0, 3);
            const overflow = items.length - visibleItems.length;

            return (
              <div
                key={key}
                className={`min-h-[110px] border-b border-r border-border p-2 last:border-r-0 ${
                  inMonth ? "bg-surface" : "bg-surface-muted/50"
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                    isToday
                      ? "bg-accent text-accent-foreground"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/60"
                  }`}
                >
                  {date.getUTCDate()}
                </span>
                <div className="mt-1 flex flex-col gap-1">
                  {visibleItems.map((item) => (
                    <Link
                      key={`${item.kind}-${item.id}`}
                      href={itemHref(item)}
                      title={itemLabel(item)}
                      className={`block truncate rounded px-1.5 py-0.5 text-xs font-medium hover:opacity-80 ${
                        item.kind === "task"
                          ? "bg-status-upcoming-bg text-status-upcoming"
                          : item.kind === "showing"
                            ? "bg-status-ontrack-bg text-status-ontrack"
                            : "bg-status-attention-bg text-status-attention"
                      }`}
                    >
                      {itemLabel(item)}
                    </Link>
                  ))}
                  {overflow > 0 ? (
                    <span className="px-1.5 text-xs text-muted-foreground">+{overflow} more</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <p className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-status-upcoming" /> Task due date
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-status-attention" /> Transaction deadline
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-status-ontrack" /> Showing
        </span>
      </p>
    </div>
  );
}

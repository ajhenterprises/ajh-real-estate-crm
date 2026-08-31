import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import {
  getActiveTransactions,
  getDashboardSummary,
  getOverdueDeadlines,
  getOverdueTasks,
  getTasksDueToday,
  getUpcomingClosings,
  getUpcomingDeadlines,
} from "@/lib/repos/dashboard";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { completeTaskAction } from "@/lib/tasks/actions";
import { contactDisplayName, formatCurrency, formatDate } from "@/lib/format";
import { deriveDeadlineStatus } from "@/lib/status";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default async function DashboardPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const [
    summary,
    overdueTasks,
    overdueDeadlines,
    tasksDueToday,
    upcomingDeadlines,
    activeTransactions,
    upcomingClosings,
  ] = await Promise.all([
    getDashboardSummary(userId),
    getOverdueTasks(userId),
    getOverdueDeadlines(userId),
    getTasksDueToday(userId),
    getUpcomingDeadlines(userId),
    getActiveTransactions(userId),
    getUpcomingClosings(userId),
  ]);

  const needsAttentionCount = overdueTasks.length + overdueDeadlines.length;
  const firstName = session.user.name?.split(" ")[0] ?? "there";

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          {greeting()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {summary.activeTransactionsCount} active transaction
          {summary.activeTransactionsCount === 1 ? "" : "s"} · {summary.tasksDueTodayCount} task
          {summary.tasksDueTodayCount === 1 ? "" : "s"} due today ·{" "}
          {summary.upcomingDeadlinesCount} upcoming deadline
          {summary.upcomingDeadlinesCount === 1 ? "" : "s"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Active clients" value={summary.activeClientsCount} />
        <StatTile label="Active transactions" value={summary.activeTransactionsCount} />
        <StatTile label="Tasks due today" value={summary.tasksDueTodayCount} />
        <StatTile label="Overdue tasks" value={summary.overdueTasksCount} />
        <StatTile label="Upcoming deadlines" value={summary.upcomingDeadlinesCount} />
      </div>

      <Card>
        <CardHeader title="Needs attention" />
        <div className="flex flex-col divide-y divide-border">
          {needsAttentionCount === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Nothing needs attention"
                description="Overdue tasks and deadlines will show up here as soon as something slips."
              />
            </div>
          ) : (
            <>
              {overdueDeadlines.map((event) => (
                <div key={event.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{event.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(event.date)} ·{" "}
                      {contactDisplayName(event.transaction.client.contact)} —{" "}
                      {event.transaction.propertyAddress ?? "No address on file"}
                    </p>
                  </div>
                  <StatusBadge variant="attention" />
                </div>
              ))}
              {overdueTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between px-5 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      Due {task.dueDate ? formatDate(task.dueDate) : "—"}
                      {task.client ? ` · ${contactDisplayName(task.client.contact)}` : ""}
                    </p>
                  </div>
                  <StatusBadge variant="attention" />
                </div>
              ))}
            </>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Today's tasks" />
          <div className="flex flex-col divide-y divide-border">
            {tasksDueToday.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No tasks due today"
                  description="Tasks assigned to you with a due date of today will show up here."
                />
              </div>
            ) : (
              tasksDueToday.map((task) => (
                <div key={task.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {task.transaction?.propertyAddress ??
                        (task.client ? contactDisplayName(task.client.contact) : "General task")}
                    </p>
                  </div>
                  <form action={completeTaskAction} className="shrink-0">
                    <input type="hidden" name="taskId" value={task.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                    >
                      Complete
                    </button>
                  </form>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Upcoming deadlines" />
          <div className="flex flex-col divide-y divide-border">
            {upcomingDeadlines.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No upcoming deadlines"
                  description="Important transaction dates — inspection periods, financing, closing — will appear here."
                />
              </div>
            ) : (
              upcomingDeadlines.map((event) => (
                <div key={event.id} className="px-5 py-3">
                  <p className="text-sm font-medium text-foreground">{event.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(event.date)} ·{" "}
                    {contactDisplayName(event.transaction.client.contact)} —{" "}
                    {event.transaction.propertyAddress ?? "No address on file"}
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Active transactions"
          action={
            <Link href="/transactions" className="text-sm font-medium text-accent">
              View all
            </Link>
          }
        />
        <div className="flex flex-col divide-y divide-border">
          {activeTransactions.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No active transactions"
                description="Your active transactions will appear here once you create your first transaction."
              />
            </div>
          ) : (
            activeTransactions.map((transaction) => {
              const nextDeadline = transaction.events[0] ?? null;
              const completedTasks = transaction.tasks.filter((t) => t.status === "COMPLETED").length;
              return (
                <Link
                  key={transaction.id}
                  href={`/transactions/${transaction.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {contactDisplayName(transaction.client.contact)}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {transaction.propertyAddress ?? "No address on file"} ·{" "}
                      {transaction.type === "BUYER" ? "Buyer" : transaction.type === "SELLER" ? "Seller" : "Other"}
                      {formatCurrency(transaction.purchasePrice?.toString()) &&
                        ` · ${formatCurrency(transaction.purchasePrice?.toString())}`}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {transaction.tasks.length > 0
                        ? `${completedTasks}/${transaction.tasks.length} tasks complete`
                        : "No tasks yet"}
                      {transaction.expectedClosingDate &&
                        ` · Closing ${formatDate(transaction.expectedClosingDate)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge variant={deriveDeadlineStatus(nextDeadline?.date ?? null)} />
                    {nextDeadline && (
                      <span className="text-xs text-muted-foreground">
                        {nextDeadline.title} · {formatDate(nextDeadline.date)}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Upcoming Closings" />
        <div className="flex flex-col divide-y divide-border">
          {upcomingClosings.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No upcoming closings"
                description="Transactions with an expected closing date will show up here as they approach."
              />
            </div>
          ) : (
            upcomingClosings.map((transaction) => (
              <Link
                key={transaction.id}
                href={`/transactions/${transaction.id}`}
                className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-muted"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {contactDisplayName(transaction.client.contact)}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {transaction.propertyAddress ?? "No address on file"}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {transaction.expectedClosingDate ? formatDate(transaction.expectedClosingDate) : "—"}
                </span>
              </Link>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

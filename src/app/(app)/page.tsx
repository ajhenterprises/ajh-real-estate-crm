import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import {
  getActiveTransactions,
  getContactsNeedingFollowUp,
  getDashboardSummary,
  getOverdueDeadlines,
  getOverdueTasks,
  getTasksDueToday,
  getUpcomingClosings,
  getUpcomingDeadlines,
  getUpcomingTasks,
} from "@/lib/repos/dashboard";
import { summarizeTaskProgress } from "@/lib/tasks/progress";
import { Card, CardHeader, StatTile } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { completeTaskAction } from "@/lib/tasks/actions";
import { contactDisplayName, formatCurrency, formatDate } from "@/lib/format";
import { deriveDeadlineStatus, deriveFollowUpStatus } from "@/lib/status";
import { CONTACT_TYPE_LABELS } from "@/lib/labels";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function TaskRow({
  task,
}: {
  task: {
    id: string;
    title: string;
    dueDate: Date | null;
    transaction: { propertyAddress: string | null } | null;
    client: { contact: { firstName: string; lastName: string } } | null;
  };
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-3">
      <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1 hover:opacity-80">
        <p className="truncate text-sm font-medium text-foreground">{task.title}</p>
        <p className="truncate text-sm text-muted-foreground">
          {task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date"} ·{" "}
          {task.transaction?.propertyAddress ??
            (task.client ? contactDisplayName(task.client.contact) : "General task")}
        </p>
      </Link>
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
  );
}

export default async function DashboardPage() {
  const session = await requireSession();
  const userId = session.user.id;

  const [
    summary,
    overdueTasks,
    overdueDeadlines,
    tasksDueToday,
    upcomingTasks,
    upcomingDeadlines,
    activeTransactions,
    upcomingClosings,
    contactsNeedingFollowUp,
  ] = await Promise.all([
    getDashboardSummary(userId),
    getOverdueTasks(userId),
    getOverdueDeadlines(userId),
    getTasksDueToday(userId),
    getUpcomingTasks(userId),
    getUpcomingDeadlines(userId),
    getActiveTransactions(userId),
    getUpcomingClosings(userId),
    getContactsNeedingFollowUp(userId),
  ]);

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
        <CardHeader title="Overdue Deadlines" />
        <div className="flex flex-col divide-y divide-border">
          {overdueDeadlines.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Nothing overdue"
                description="Overdue transaction deadlines will show up here as soon as something slips."
              />
            </div>
          ) : (
            overdueDeadlines.map((event) => (
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
            ))
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Needs Follow-Up" />
        <div className="flex flex-col divide-y divide-border">
          {contactsNeedingFollowUp.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="Nobody needs follow-up right now"
                description="Contacts with a follow-up date today or earlier will show up here."
              />
            </div>
          ) : (
            contactsNeedingFollowUp.map((contact) => {
              const followUpStatus = deriveFollowUpStatus(contact.nextFollowUpDate);
              return (
                <Link
                  key={contact.id}
                  href={`/contacts/${contact.id}`}
                  className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-muted"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{contactDisplayName(contact)}</p>
                    <p className="truncate text-sm text-muted-foreground">
                      {CONTACT_TYPE_LABELS[contact.contactType]} · Follow up{" "}
                      {contact.nextFollowUpDate ? formatDate(contact.nextFollowUpDate) : ""}
                    </p>
                  </div>
                  <StatusBadge
                    variant="attention"
                    label={followUpStatus === "overdue" ? "Overdue" : "Today"}
                  />
                </Link>
              );
            })
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Overdue Tasks" />
          <div className="flex flex-col divide-y divide-border">
            {overdueTasks.length === 0 ? (
              <div className="p-5">
                <EmptyState title="No overdue tasks" description="Tasks past their due date will show up here." />
              </div>
            ) : (
              overdueTasks.map((task) => <TaskRow key={task.id} task={task} />)
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Today's Tasks" />
          <div className="flex flex-col divide-y divide-border">
            {tasksDueToday.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No tasks due today"
                  description="Tasks assigned to you with a due date of today will show up here."
                />
              </div>
            ) : (
              tasksDueToday.map((task) => <TaskRow key={task.id} task={task} />)
            )}
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Upcoming Tasks" />
          <div className="flex flex-col divide-y divide-border">
            {upcomingTasks.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No upcoming tasks"
                  description="Pending tasks due after today will show up here."
                />
              </div>
            ) : (
              upcomingTasks.map((task) => <TaskRow key={task.id} task={task} />)
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Upcoming Deadlines" />
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
              const taskProgress = summarizeTaskProgress(transaction.tasks);
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
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      {taskProgress.total > 0
                        ? `${taskProgress.complete}/${taskProgress.total} tasks complete`
                        : "No tasks yet"}
                      {taskProgress.overdue > 0 ? (
                        <span className="font-medium text-status-attention">
                          · {taskProgress.overdue} overdue
                        </span>
                      ) : null}
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

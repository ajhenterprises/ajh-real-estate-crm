import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getTaskById } from "@/lib/repos/tasks";
import {
  cancelTaskAction,
  completeTaskAction,
  reopenTaskAction,
  resetTaskDueDateOverrideAction,
} from "@/lib/tasks/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { contactDisplayName, formatDateWithYear } from "@/lib/format";
import { TASK_PRIORITY_LABELS, TASK_STATUS_LABELS } from "@/lib/labels";

export default async function TaskDetailPage(props: PageProps<"/tasks/[id]">) {
  const session = await requireSession();
  const { id } = await props.params;

  const task = await getTaskById(session.user.id, id);
  if (!task) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/tasks" className="hover:text-foreground">
              Tasks
            </Link>{" "}
            / {task.title}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-foreground">{task.title}</h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/tasks/${task.id}/edit`}
            className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            Edit
          </Link>
          {task.status === "PENDING" ? (
            <>
              <form action={completeTaskAction}>
                <input type="hidden" name="taskId" value={task.id} />
                <button
                  type="submit"
                  className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
                >
                  Complete
                </button>
              </form>
              <form action={cancelTaskAction}>
                <input type="hidden" name="taskId" value={task.id} />
                <button
                  type="submit"
                  className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
                >
                  Cancel
                </button>
              </form>
            </>
          ) : (
            <form action={reopenTaskAction}>
              <input type="hidden" name="taskId" value={task.id} />
              <button
                type="submit"
                className="rounded-md border border-border px-3 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
              >
                Reopen
              </button>
            </form>
          )}
        </div>
      </div>

      <Card>
        <CardHeader title="Task Details" />
        <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2">
          <InfoField label="Status" value={TASK_STATUS_LABELS[task.status]} />
          <InfoField label="Priority" value={TASK_PRIORITY_LABELS[task.priority]} />
          <InfoField label="Due date" value={task.dueDate ? formatDateWithYear(task.dueDate) : null} />
          <InfoField
            label="Completed date"
            value={task.completedDate ? formatDateWithYear(task.completedDate) : null}
          />
          <InfoField
            label="Contact"
            value={task.contact ? contactDisplayName(task.contact) : null}
            href={task.contact ? `/contacts/${task.contact.id}` : undefined}
          />
          <InfoField
            label="Transaction"
            value={task.transaction?.propertyAddress ?? (task.transaction ? "Transaction" : null)}
            href={task.transaction ? `/transactions/${task.transaction.id}` : undefined}
          />
          <InfoField label="Created" value={formatDateWithYear(task.createdAt)} />
        </div>
        {task.description ? (
          <div className="border-t border-border px-5 py-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{task.description}</p>
          </div>
        ) : null}
      </Card>

      {task.transactionEvent ? (
        <Card>
          <CardHeader title="Linked Contract Deadline" />
          <div className="flex flex-col gap-2 p-5">
            <p className="text-sm text-foreground">
              This task&rsquo;s due date is generated from{" "}
              {task.transaction ? (
                <Link
                  href={`/transactions/${task.transaction.id}/events/${task.transactionEvent.id}/edit`}
                  className="text-accent hover:underline"
                >
                  {task.transactionEvent.title}
                </Link>
              ) : (
                task.transactionEvent.title
              )}
              .
            </p>
            {task.isOverridden ? (
              <div className="mt-1 flex items-center justify-between gap-3 rounded-md bg-status-upcoming-bg px-3 py-2">
                <p className="text-sm text-status-upcoming">
                  This due date has been manually overridden and will no longer update when the
                  contract is re-confirmed.
                </p>
                <form action={resetTaskDueDateOverrideAction}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <button
                    type="submit"
                    className="shrink-0 rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                  >
                    Reset to calculated date
                  </button>
                </form>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Changing the due date on the edit page will mark this task as manually overridden,
                so re-confirming the contract won&rsquo;t move it.
              </p>
            )}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function InfoField({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null | undefined;
  href?: string;
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      {value && href ? (
        <Link href={href} className="mt-0.5 block text-sm text-accent hover:underline">
          {value}
        </Link>
      ) : (
        <p className="mt-0.5 text-sm text-foreground">{value || "—"}</p>
      )}
    </div>
  );
}

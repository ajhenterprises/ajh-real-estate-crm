import { requireSession } from "@/lib/auth/session";
import { listTasks } from "@/lib/repos/lists";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { completeTaskAction, reopenTaskAction } from "@/lib/tasks/actions";
import { contactDisplayName, formatDate } from "@/lib/format";

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  URGENT: "Urgent",
};

export default async function TasksPage() {
  const session = await requireSession();
  const tasks = await listTasks(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Everything on your plate — general, or tied to a contact, client, or transaction.
        </p>
      </div>

      <Card>
        {tasks.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No tasks yet"
              description="Tasks you create — for yourself, a client, or a transaction — will appear here."
            />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {tasks.map((task) => (
              <div key={task.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <div className="min-w-0">
                  <p
                    className={`truncate text-sm font-medium ${
                      task.status === "COMPLETED"
                        ? "text-muted-foreground line-through"
                        : "text-foreground"
                    }`}
                  >
                    {task.title}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date"} ·{" "}
                    {PRIORITY_LABELS[task.priority]}
                    {task.transaction?.propertyAddress
                      ? ` · ${task.transaction.propertyAddress}`
                      : task.client
                        ? ` · ${contactDisplayName(task.client.contact)}`
                        : ""}
                  </p>
                </div>
                {task.status === "PENDING" ? (
                  <form action={completeTaskAction} className="shrink-0">
                    <input type="hidden" name="taskId" value={task.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                    >
                      Complete
                    </button>
                  </form>
                ) : task.status === "COMPLETED" ? (
                  <form action={reopenTaskAction} className="shrink-0">
                    <input type="hidden" name="taskId" value={task.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                    >
                      Reopen
                    </button>
                  </form>
                ) : (
                  <span className="shrink-0 text-xs text-muted-foreground">Cancelled</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

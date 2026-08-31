import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import {
  listTasks,
  type TaskRelationshipFilter,
  type TaskSort,
  type TaskStatusFilter,
} from "@/lib/repos/tasks";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, TextInput } from "@/components/ui/form";
import { cancelTaskAction, completeTaskAction, reopenTaskAction } from "@/lib/tasks/actions";
import { contactDisplayName, formatDate } from "@/lib/format";
import { TASK_PRIORITY_LABELS } from "@/lib/labels";
import type { TaskPriority } from "@/generated/prisma/enums";

const STATUS_OPTIONS: { value: TaskStatusFilter | ""; label: string }[] = [
  { value: "", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "OVERDUE", label: "Overdue" },
];

const RELATIONSHIP_OPTIONS: { value: TaskRelationshipFilter | ""; label: string }[] = [
  { value: "", label: "All tasks" },
  { value: "TRANSACTION", label: "Transaction tasks" },
  { value: "CLIENT", label: "Client tasks" },
  { value: "GENERAL", label: "General tasks" },
];

const SORT_OPTIONS: { value: TaskSort; label: string }[] = [
  { value: "smart", label: "Actionable first" },
  { value: "due_date", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
];

export default async function TasksPage(props: PageProps<"/tasks">) {
  const session = await requireSession();
  const searchParams = await props.searchParams;

  const search = typeof searchParams.q === "string" ? searchParams.q : undefined;
  const status = typeof searchParams.status === "string" ? (searchParams.status as TaskStatusFilter) : undefined;
  const priority =
    typeof searchParams.priority === "string" ? (searchParams.priority as TaskPriority) : undefined;
  const relationship =
    typeof searchParams.relationship === "string"
      ? (searchParams.relationship as TaskRelationshipFilter)
      : undefined;
  const sort = typeof searchParams.sort === "string" ? (searchParams.sort as TaskSort) : undefined;

  const tasks = await listTasks(session.user.id, { search, status, priority, relationship, sort });
  const hasFilters = Boolean(search || status || priority || relationship);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Tasks</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything on your plate — general, or tied to a client or transaction.
          </p>
        </div>
        <Link
          href="/tasks/new"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          New Task
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <TextInput type="search" name="q" placeholder="Search title, client, property" defaultValue={search} />
        </div>
        <Select name="status" defaultValue={status ?? ""}>
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select name="priority" defaultValue={priority ?? ""}>
          <option value="">All priorities</option>
          {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select name="relationship" defaultValue={relationship ?? ""}>
          {RELATIONSHIP_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <Select name="sort" defaultValue={sort ?? "smart"}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
        <button
          type="submit"
          className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
        >
          Apply
        </button>
      </form>

      <Card>
        {tasks.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title={hasFilters ? "No tasks match" : "No tasks yet"}
              description={
                hasFilters
                  ? "Try a different search or clear the filters."
                  : "Tasks you create — for yourself, a client, or a transaction — will appear here."
              }
            />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {tasks.map((task) => {
              const isOverdue =
                task.status === "PENDING" && task.dueDate !== null && task.dueDate < new Date();
              return (
                <div key={task.id} className="flex items-center justify-between gap-4 px-5 py-3">
                  <Link href={`/tasks/${task.id}`} className="min-w-0 flex-1 hover:opacity-80">
                    <p
                      className={`truncate text-sm font-medium ${
                        task.status === "COMPLETED"
                          ? "text-muted-foreground line-through"
                          : task.status === "CANCELLED"
                            ? "text-muted-foreground line-through"
                            : isOverdue
                              ? "text-status-attention"
                              : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {task.dueDate ? `Due ${formatDate(task.dueDate)}` : "No due date"} ·{" "}
                      {TASK_PRIORITY_LABELS[task.priority]}
                      {task.transaction?.propertyAddress
                        ? ` · ${task.transaction.propertyAddress}`
                        : task.client
                          ? ` · ${contactDisplayName(task.client.contact)}`
                          : " · General"}
                    </p>
                  </Link>
                  {task.status === "PENDING" ? (
                    <div className="flex shrink-0 gap-2">
                      <form action={completeTaskAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                        >
                          Complete
                        </button>
                      </form>
                      <form action={cancelTaskAction}>
                        <input type="hidden" name="taskId" value={task.id} />
                        <button
                          type="submit"
                          className="rounded-md border border-border px-2.5 py-1 text-xs font-medium text-foreground hover:bg-surface-muted"
                        >
                          Cancel
                        </button>
                      </form>
                    </div>
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
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

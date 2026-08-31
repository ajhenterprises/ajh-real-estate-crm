import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/auth/session";
import { getTaskById, listTaskFormOptions } from "@/lib/repos/tasks";
import { updateTaskAction } from "@/lib/tasks/actions";
import { Card } from "@/components/ui/card";
import { TaskForm } from "@/components/tasks/task-form";
import { toDateInputValue } from "@/lib/format";

export default async function EditTaskPage(props: PageProps<"/tasks/[id]/edit">) {
  const session = await requireSession();
  const { id } = await props.params;

  const [task, options] = await Promise.all([
    getTaskById(session.user.id, id),
    listTaskFormOptions(session.user.id),
  ]);
  if (!task) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/tasks/${task.id}`} className="hover:text-foreground">
            {task.title}
          </Link>{" "}
          / Edit
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-foreground">Edit Task</h1>
      </div>

      <Card className="max-w-2xl p-6">
        <TaskForm
          action={updateTaskAction}
          hiddenField={{ name: "taskId", value: task.id }}
          options={options}
          submitLabel="Save changes"
          pendingLabel="Saving…"
          defaultValues={{
            title: task.title,
            description: task.description ?? undefined,
            dueDate: toDateInputValue(task.dueDate),
            priority: task.priority,
            status: task.status,
            clientId: task.clientId ?? undefined,
            transactionId: task.transactionId ?? undefined,
          }}
        />
      </Card>
    </div>
  );
}

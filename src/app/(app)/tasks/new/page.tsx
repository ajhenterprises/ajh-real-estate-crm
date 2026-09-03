import { requireSession } from "@/lib/auth/session";
import { listTaskFormOptions } from "@/lib/repos/tasks";
import { createTaskAction } from "@/lib/tasks/actions";
import { Card } from "@/components/ui/card";
import { TaskForm } from "@/components/tasks/task-form";

export default async function NewTaskPage() {
  const session = await requireSession();
  const options = await listTaskFormOptions(session.user.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">New Task</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          General task, or tied to a contact, client, or transaction.
        </p>
      </div>

      <Card className="max-w-2xl p-6">
        <TaskForm
          action={createTaskAction}
          options={options}
          submitLabel="Save task"
          pendingLabel="Saving…"
        />
      </Card>
    </div>
  );
}

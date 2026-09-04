import Link from "next/link";
import { requireSession } from "@/lib/auth/session";
import { listRecentNotifications, listUpcomingNotifications } from "@/lib/repos/notifications";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/lib/notifications/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTimeWithYear } from "@/lib/format";

const CATEGORY_LABELS: Record<string, string> = {
  TASK: "Task",
  FOLLOW_UP: "Follow-up",
  TRANSACTION_DEADLINE: "Transaction deadline",
};

export default async function NotificationsPage() {
  const session = await requireSession();
  const [upcoming, recent] = await Promise.all([
    listUpcomingNotifications(session.user.id),
    listRecentNotifications(session.user.id),
  ]);

  const hasUnread = recent.some((notification) => !notification.readAt);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upcoming reminders and everything already sent — tap one to jump straight to it.
        </p>
      </div>

      <Card>
        <CardHeader title="Upcoming" />
        {upcoming.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Nothing scheduled"
              description="Task due dates, follow-ups, and transaction deadlines will show up here as reminders."
            />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {upcoming.map((notification) => (
              <Link
                key={notification.id}
                href={notification.url}
                className="flex items-center justify-between gap-4 px-5 py-3 hover:bg-surface-muted"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{notification.title}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {CATEGORY_LABELS[notification.category] ?? notification.category} · {notification.body}
                  </p>
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {formatDateTimeWithYear(notification.sendAt)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Recent"
          action={
            hasUnread ? (
              <form action={markAllNotificationsReadAction}>
                <button type="submit" className="text-sm font-medium text-accent">
                  Mark all read
                </button>
              </form>
            ) : null
          }
        />
        {recent.length === 0 ? (
          <div className="p-5">
            <EmptyState title="Nothing sent yet" description="Delivered reminders will show up here." />
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {recent.map((notification) => (
              <div key={notification.id} className="flex items-center justify-between gap-4 px-5 py-3">
                <Link href={notification.url} className="min-w-0 flex-1 hover:opacity-80">
                  <p className={`truncate text-sm font-medium ${notification.readAt ? "text-muted-foreground" : "text-foreground"}`}>
                    {notification.title}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {CATEGORY_LABELS[notification.category] ?? notification.category} · {notification.body} ·{" "}
                    {formatDateTimeWithYear(notification.sentAt ?? notification.sendAt)}
                  </p>
                </Link>
                {!notification.readAt ? (
                  <form action={markNotificationReadAction} className="shrink-0">
                    <input type="hidden" name="notificationId" value={notification.id} />
                    <button
                      type="submit"
                      className="rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
                    >
                      Mark read
                    </button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

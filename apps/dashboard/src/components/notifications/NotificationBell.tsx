"use client";

import { useMemo } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { useRouter } from "next/navigation";
import {
  Bell,
  CheckCheck,
  CreditCard,
  ArrowLeftRight,
  Receipt,
  RotateCcw,
  Users,
  KeyRound,
  Webhook,
} from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  ScrollArea,
  cn,
} from "@useroutr/ui";
import {
  DashboardNotification,
  useNotifications,
} from "@/providers/NotificationsProvider";

function getNotificationHref(notification: DashboardNotification): string {
  const metadata = notification.metadata ?? {};

  switch (notification.type) {
    case "payment.received":
      return typeof metadata.paymentId === "string"
        ? `/payments/${metadata.paymentId}`
        : "/payments";
    case "invoice.paid":
      return typeof metadata.invoiceId === "string"
        ? `/invoices/${metadata.invoiceId}`
        : "/invoices";
    case "payout.completed":
    case "payout.failed":
      return "/payouts";
    case "refund.initiated":
      return "/refunds";
    case "team.member_joined":
      return "/settings/team";
    case "api_key.created":
      return "/settings/api-keys";
    case "webhook.failed":
      return "/settings/webhooks";
    default:
      return "/settings";
  }
}

function NotificationTypeIcon({ type }: { type: string }) {
  const className = "size-4";

  switch (type) {
    case "payment.received":
      return <CreditCard className={cn(className, "text-emerald-500")} />;
    case "invoice.paid":
      return <Receipt className={cn(className, "text-blue")} />;
    case "payout.completed":
      return <ArrowLeftRight className={cn(className, "text-emerald-500")} />;
    case "payout.failed":
      return <ArrowLeftRight className={cn(className, "text-red")} />;
    case "refund.initiated":
      return <RotateCcw className={cn(className, "text-amber")} />;
    case "team.member_joined":
      return <Users className={cn(className, "text-purple")} />;
    case "api_key.created":
      return <KeyRound className={cn(className, "text-amber")} />;
    case "webhook.failed":
      return <Webhook className={cn(className, "text-red")} />;
    default:
      return <Bell className={cn(className, "text-primary")} />;
  }
}

export function NotificationBell() {
  const router = useRouter();
  const {
    notifications,
    unreadCount,
    isLoading,
    highlightedIds,
    markAsRead,
    markAllAsRead,
  } = useNotifications();

  const unreadLabel = useMemo(() => {
    if (unreadCount <= 0) {
      return null;
    }

    return unreadCount > 9 ? "9+" : String(unreadCount);
  }, [unreadCount]);

  const handleNotificationClick = async (notification: DashboardNotification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    router.push(getNotificationHref(notification));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-8 w-8"
          aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ""}`}
        >
          <Bell className="size-4" />
          {unreadLabel ? (
            <span className="absolute -right-1 -top-1 inline-flex min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {unreadLabel}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-95 rounded-2xl border-border/70 bg-popover p-0 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}`
                : "You’re all caught up"}
            </p>
          </div>

          <button
            type="button"
            onClick={() => void markAllAsRead()}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckCheck className="size-3.5" />
            Mark all as read
          </button>
        </div>

        <ScrollArea className="max-h-105">
          <div className="p-2">
            {!isLoading && notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
                <div className="mb-3 rounded-full bg-secondary p-3 text-muted-foreground">
                  <Bell className="size-5" />
                </div>
                <p className="text-sm font-medium text-foreground">No notifications yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  New payment, payout, invoice, and webhook activity will appear here.
                </p>
              </div>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void handleNotificationClick(notification)}
                  className={cn(
                    "mb-1 flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all duration-200 hover:border-border hover:bg-secondary/50 focus:outline-none focus:ring-2 focus:ring-ring",
                    notification.read
                      ? "border-transparent bg-transparent"
                      : "border-primary/10 bg-primary/5",
                    highlightedIds.has(notification.id) &&
                      "border-emerald-400/40 bg-emerald-500/10",
                  )}
                >
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    <NotificationTypeIcon type={notification.type} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p
                        className={cn(
                          "truncate text-sm text-foreground",
                          !notification.read && "font-semibold",
                        )}
                      >
                        {notification.title}
                      </p>
                      {!notification.read ? (
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                      ) : null}
                    </div>

                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {notification.body}
                    </p>

                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {formatDistanceToNowStrict(new Date(notification.createdAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

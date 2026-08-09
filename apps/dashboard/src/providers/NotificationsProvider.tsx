"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "@/lib/api";
import { useDashboardSocket } from "@/hooks/useDashboardSocket";

export interface DashboardNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

interface NotificationsResponse {
  data: DashboardNotification[];
  meta?: {
    unreadCount?: number;
    total?: number;
    nextCursor?: string;
    limit?: number;
  };
}

interface NotificationsContextValue {
  notifications: DashboardNotification[];
  unreadCount: number;
  isLoading: boolean;
  highlightedIds: Set<string>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: DashboardNotification) => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(
  undefined,
);

const MAX_NOTIFICATIONS = 50;

function normalizeSocketNotification(
  raw: unknown,
): DashboardNotification | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const candidate = raw as Record<string, unknown>;
  const id = typeof candidate.id === "string" ? candidate.id : undefined;
  const type = typeof candidate.type === "string" ? candidate.type : undefined;
  const title =
    typeof candidate.title === "string" ? candidate.title : undefined;
  const body = typeof candidate.body === "string" ? candidate.body : undefined;
  const createdAt =
    typeof candidate.createdAt === "string"
      ? candidate.createdAt
      : new Date().toISOString();

  if (!id || !type || !title || !body) {
    return null;
  }

  return {
    id,
    type,
    title,
    body,
    read: false,
    metadata:
      candidate.metadata && typeof candidate.metadata === "object"
        ? (candidate.metadata as Record<string, unknown>)
        : null,
    createdAt,
  };
}

export function NotificationsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { connected, subscribe } = useDashboardSocket();
  const [notifications, setNotifications] = useState<DashboardNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [highlightedIds, setHighlightedIds] = useState<Set<string>>(new Set());
  const highlightTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  const highlightNotification = useCallback((id: string) => {
    setHighlightedIds((prev) => new Set([...prev, id]));

    const existingTimeout = highlightTimeoutsRef.current.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(() => {
      setHighlightedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      highlightTimeoutsRef.current.delete(id);
    }, 2200);

    highlightTimeoutsRef.current.set(id, timeout);
  }, []);

  const addNotification = useCallback(
    (notification: DashboardNotification) => {
      setNotifications((prev) => {
        const alreadyExists = prev.some((item) => item.id === notification.id);

        if (!alreadyExists) {
          setUnreadCount((count) => count + 1);
          highlightNotification(notification.id);
        }

        const next = [notification, ...prev.filter((item) => item.id !== notification.id)];
        return next.slice(0, MAX_NOTIFICATIONS);
      });
    },
    [highlightNotification],
  );

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await api.get<NotificationsResponse>("/notifications", {
        params: { limit: 50 },
      });

      setNotifications(response.data ?? []);
      setUnreadCount(
        response.meta?.unreadCount ??
          (response.data ?? []).filter((item) => !item.read).length,
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchNotifications();

    return () => {
      highlightTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout));
      highlightTimeoutsRef.current.clear();
    };
  }, [fetchNotifications]);

  useEffect(() => {
    if (!connected) {
      return;
    }

    const unsubscribeDirect = subscribe("notification.created", (raw) => {
      const notification = normalizeSocketNotification(raw);
      if (notification) {
        addNotification(notification);
      }
    });

    const unsubscribeEnvelope = subscribe("message", (raw) => {
      const message = raw as { event?: string; data?: unknown };

      if (message?.event !== "notification.created") {
        return;
      }

      const notification = normalizeSocketNotification(message.data);
      if (notification) {
        addNotification(notification);
      }
    });

    return () => {
      unsubscribeDirect();
      unsubscribeEnvelope();
    };
  }, [addNotification, connected, subscribe]);

  const markAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((item) => (item.id === id ? { ...item, read: true } : item)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    try {
      await api.patch(`/notifications/${id}/read`);
    } catch {
      setNotifications((prev) =>
        prev.map((item) => (item.id === id ? { ...item, read: false } : item)),
      );
      setUnreadCount((prev) => prev + 1);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    const previousNotifications = notifications;
    const previousUnreadCount = unreadCount;

    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);

    try {
      await api.post("/notifications/mark-all-read");
    } catch {
      setNotifications(previousNotifications);
      setUnreadCount(previousUnreadCount);
    }
  }, [notifications, unreadCount]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      notifications,
      unreadCount,
      isLoading,
      highlightedIds,
      markAsRead,
      markAllAsRead,
      addNotification,
    }),
    [addNotification, highlightedIds, isLoading, markAllAsRead, markAsRead, notifications, unreadCount],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationsContext);

  if (!context) {
    throw new Error("useNotifications must be used within NotificationsProvider");
  }

  return context;
}

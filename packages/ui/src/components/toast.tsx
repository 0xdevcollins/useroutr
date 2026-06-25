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
import {
  X,
  CheckCircle,
  XCircle,
  Warning,
  Info,
} from "@phosphor-icons/react";
import { cn } from "../utils";

export type ToastVariant = "success" | "error" | "warning" | "info";

export interface ToastProps {
  id: string;
  type: ToastVariant;
  title?: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  duration?: number;
  onClose: () => void;
  onAction?: () => void;
}

interface ToastInput {
  type?: ToastVariant;
  title?: string;
  message: string;
  actionLabel?: string;
  actionHref?: string;
  duration?: number;
  onAction?: () => void;
}

interface ToastItem extends ToastInput {
  id: string;
  type: ToastVariant;
  duration: number;
}

interface ToastContextValue {
  toast: (messageOrOptions: string | ToastInput, variant?: ToastVariant) => string;
  success: (messageOrOptions: string | Omit<ToastInput, "type">) => string;
  error: (messageOrOptions: string | Omit<ToastInput, "type">) => string;
  warning: (messageOrOptions: string | Omit<ToastInput, "type">) => string;
  info: (messageOrOptions: string | Omit<ToastInput, "type">) => string;
  dismiss: (id: string) => void;
  clearAll: () => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const MAX_VISIBLE = 3;
const DEFAULT_DURATION = 4000;
const EXIT_DURATION = 200;

const VARIANT_CONFIG: Record<
  ToastVariant,
  {
    bg: string;
    icon: typeof CheckCircle;
    iconColor: string;
    actionClass: string;
  }
> = {
  success: {
    bg: "border-[var(--green)]/30 bg-[var(--green)]/10",
    icon: CheckCircle,
    iconColor: "text-[var(--green)]",
    actionClass: "text-[var(--green)] hover:text-[var(--green)]/80",
  },
  error: {
    bg: "border-[var(--red)]/30 bg-[var(--red)]/10",
    icon: XCircle,
    iconColor: "text-[var(--red)]",
    actionClass: "text-[var(--red)] hover:text-[var(--red)]/80",
  },
  warning: {
    bg: "border-[var(--amber)]/30 bg-[var(--amber)]/10",
    icon: Warning,
    iconColor: "text-[var(--amber)]",
    actionClass: "text-[var(--amber)] hover:text-[var(--amber)]/80",
  },
  info: {
    bg: "border-[var(--blue)]/30 bg-[var(--blue)]/10",
    icon: Info,
    iconColor: "text-[var(--blue)]",
    actionClass: "text-[var(--blue)] hover:text-[var(--blue)]/80",
  },
};

function createToastId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function normalizeToastInput(
  messageOrOptions: string | ToastInput,
  variant: ToastVariant,
): ToastItem {
  if (typeof messageOrOptions === "string") {
    return {
      id: createToastId(),
      type: variant,
      message: messageOrOptions,
      duration: DEFAULT_DURATION,
    };
  }

  return {
    id: createToastId(),
    type: messageOrOptions.type ?? variant,
    title: messageOrOptions.title,
    message: messageOrOptions.message,
    actionLabel: messageOrOptions.actionLabel,
    actionHref: messageOrOptions.actionHref,
    duration: messageOrOptions.duration ?? DEFAULT_DURATION,
    onAction: messageOrOptions.onAction,
  };
}

function Toast({
  id,
  type,
  title,
  message,
  actionLabel,
  actionHref,
  duration = DEFAULT_DURATION,
  onClose,
  onAction,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [remaining, setRemaining] = useState(duration);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startedAtRef = useRef<number | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    startedAtRef.current = null;
  }, []);

  const closeToast = useCallback(() => {
    clearTimer();
    setIsVisible(false);
    window.setTimeout(() => onClose(), EXIT_DURATION);
  }, [clearTimer, onClose]);

  const scheduleDismiss = useCallback(
    (timeoutMs: number) => {
      clearTimer();

      if (timeoutMs <= 0) {
        closeToast();
        return;
      }

      setRemaining(timeoutMs);
      startedAtRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        closeToast();
      }, timeoutMs);
    },
    [clearTimer, closeToast],
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setIsVisible(true));
    scheduleDismiss(duration);

    return () => {
      window.cancelAnimationFrame(frame);
      clearTimer();
    };
  }, [clearTimer, duration, scheduleDismiss]);

  const pauseDismiss = useCallback(() => {
    if (startedAtRef.current === null) {
      return;
    }

    const elapsed = Date.now() - startedAtRef.current;
    clearTimer();
    setRemaining((current) => Math.max(0, current - elapsed));
  }, [clearTimer]);

  const resumeDismiss = useCallback(() => {
    if (remaining > 0) {
      scheduleDismiss(remaining);
    }
  }, [remaining, scheduleDismiss]);

  const handleAction = useCallback(() => {
    if (onAction) {
      onAction();
    } else if (actionHref) {
      window.location.assign(actionHref);
    }

    closeToast();
  }, [actionHref, closeToast, onAction]);

  const config = VARIANT_CONFIG[type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "overflow-hidden transition-all duration-200 ease-out",
        isVisible
          ? "max-h-[240px] translate-y-0 opacity-100"
          : "max-h-0 translate-y-3 opacity-0",
      )}
    >
      <div
        role="status"
        aria-live="polite"
        tabIndex={0}
        onMouseEnter={pauseDismiss}
        onMouseLeave={resumeDismiss}
        onFocus={pauseDismiss}
        onBlur={resumeDismiss}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            closeToast();
          }
        }}
        className={cn(
          "pointer-events-auto w-full max-w-[320px] rounded-2xl border px-4 py-3 text-left shadow-[0_12px_32px_rgba(15,23,42,0.14)] backdrop-blur-sm",
          "focus:outline-none focus:ring-2 focus:ring-[var(--ring)] focus:ring-offset-2",
          config.bg,
        )}
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 shrink-0">
            <Icon size={18} weight="fill" className={config.iconColor} />
          </div>

          <div className="min-w-0 flex-1">
            {title ? (
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {title}
              </p>
            ) : null}

            <p className="text-sm leading-5 text-[var(--foreground)]/90">
              {message}
            </p>

            {actionLabel && (actionHref || onAction) ? (
              <button
                type="button"
                onClick={handleAction}
                className={cn(
                  "mt-2 text-sm font-medium transition-colors focus:outline-none",
                  config.actionClass,
                )}
              >
                {actionLabel}
              </button>
            ) : null}
          </div>

          <button
            type="button"
            data-toast-close
            onClick={closeToast}
            aria-label="Dismiss notification"
            className="shrink-0 rounded-md p-1 text-[var(--muted-foreground)] transition-colors hover:bg-black/5 hover:text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--ring)]"
          >
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  const addToast = useCallback(
    (messageOrOptions: string | ToastInput, variant: ToastVariant = "info") => {
      const nextToast = normalizeToastInput(messageOrOptions, variant);

      setToasts((prev) => [...prev.slice(-(MAX_VISIBLE - 1)), nextToast]);

      return nextToast.id;
    },
    [],
  );

  const contextValue = useMemo<ToastContextValue>(
    () => ({
      toast: addToast,
      success: (messageOrOptions) => addToast(messageOrOptions, "success"),
      error: (messageOrOptions) => addToast(messageOrOptions, "error"),
      warning: (messageOrOptions) => addToast(messageOrOptions, "warning"),
      info: (messageOrOptions) => addToast(messageOrOptions, "info"),
      dismiss,
      clearAll,
    }),
    [addToast, clearAll, dismiss],
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div
        aria-live="polite"
        aria-relevant="additions text"
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-[320px] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            id={toast.id}
            type={toast.type}
            title={toast.title}
            message={toast.message}
            actionLabel={toast.actionLabel}
            actionHref={toast.actionHref}
            duration={toast.duration}
            onAction={toast.onAction}
            onClose={() => dismiss(toast.id)}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function useToast() {
  const ctx = useContext(ToastContext);

  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }

  return ctx;
}

export { Toast, ToastProvider, useToast };

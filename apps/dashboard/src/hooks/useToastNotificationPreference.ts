"use client";

import { useCallback, useEffect, useState } from "react";

export const TOAST_NOTIFICATIONS_ENABLED_KEY = "toast_notifications_enabled";

function readStoredPreference(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  const stored = window.localStorage.getItem(TOAST_NOTIFICATIONS_ENABLED_KEY);
  return stored === null ? true : stored === "true";
}

export function getToastNotificationsEnabled(): boolean {
  return readStoredPreference();
}

export function useToastNotificationPreference() {
  const [enabled, setEnabledState] = useState(true);

  useEffect(() => {
    setEnabledState(readStoredPreference());
  }, []);

  const setEnabled = useCallback((value: boolean) => {
    setEnabledState(value);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        TOAST_NOTIFICATIONS_ENABLED_KEY,
        String(value),
      );
    }
  }, []);

  return {
    enabled,
    setEnabled,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/hooks/useAuth";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000";

let sharedSocket: Socket | null = null;
let sharedToken: string | null = null;

function createDashboardSocket(token: string) {
  return io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: 10,
    query: {
      type: "merchant",
      token: `Bearer ${token}`,
    },
  });
}

export function useDashboardSocket() {
  const { token, merchant } = useAuth();
  const merchantIdRef = useRef<string | null>(merchant?.id ?? null);
  const [connected, setConnected] = useState(Boolean(sharedSocket?.connected));

  merchantIdRef.current = merchant?.id ?? null;

  useEffect(() => {
    if (!token || !merchant?.id) {
      setConnected(false);

      if (sharedSocket) {
        sharedSocket.disconnect();
        sharedSocket = null;
        sharedToken = null;
      }

      return;
    }

    if (!sharedSocket || sharedToken !== token) {
      sharedSocket?.disconnect();
      sharedSocket = createDashboardSocket(token);
      sharedToken = token;
    }

    const socket = sharedSocket;

    const handleConnect = () => {
      setConnected(true);
      socket.emit("subscribe:merchant", merchantIdRef.current);
    };

    const handleDisconnect = () => {
      setConnected(false);
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("connect_error", handleDisconnect);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("connect_error", handleDisconnect);
    };
  }, [merchant?.id, token]);

  const subscribe = useCallback(
    (event: string, callback: (...args: unknown[]) => void) => {
      if (!sharedSocket) {
        return () => undefined;
      }

      sharedSocket.on(event, callback);

      return () => {
        sharedSocket?.off(event, callback);
      };
    },
    [],
  );

  return { connected, subscribe, socket: sharedSocket };
}

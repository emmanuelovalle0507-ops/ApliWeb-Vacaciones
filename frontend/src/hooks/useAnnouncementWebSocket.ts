"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/providers/AuthProvider";

/**
 * Connects to the backend WebSocket at /ws/announcements and invalidates
 * TanStack Query caches when real-time events arrive.
 *
 * Events handled:
 *  - announcement_created  → refetch feeds + popup
 *  - reaction_updated      → refetch feeds
 *  - read_count_updated    → refetch feeds
 *  - acknowledged          → refetch feeds
 */
export default function useAnnouncementWebSocket() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const invalidateAll = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["announcements"] });
    qc.invalidateQueries({ queryKey: ["announcements.pinned"] });
    qc.invalidateQueries({ queryKey: ["announcements.unreadCount"] });
    qc.invalidateQueries({ queryKey: ["announcements.newSince"] });
  }, [qc]);

  const connect = useCallback(() => {
    if (!user) return;
    const token = typeof window !== "undefined" ? localStorage.getItem("vc_token") : null;
    if (!token) return;

    // Determine WS URL from API base
    const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || "/api/v1";
    let wsBase: string;
    if (apiBase.startsWith("http://") || apiBase.startsWith("https://")) {
      wsBase = apiBase.replace(/^http/, "ws").replace(/\/api\/v1\/?$/, "");
    } else {
      // Relative path — use current host
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      wsBase = `${proto}//${window.location.host}`;
    }
    const wsUrl = `${wsBase}/ws/announcements?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        retryCountRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          switch (data.type) {
            case "announcement_created":
              invalidateAll();
              break;
            case "reaction_updated":
              qc.invalidateQueries({ queryKey: ["announcements"] });
              qc.invalidateQueries({ queryKey: ["announcements.newSince"] });
              break;
            case "read_count_updated":
              qc.invalidateQueries({ queryKey: ["announcements"] });
              break;
            case "acknowledged":
              qc.invalidateQueries({ queryKey: ["announcements"] });
              break;
            case "pong":
              break;
            default:
              break;
          }
        } catch {
          // ignore non-JSON
        }
      };

      ws.onclose = () => {
        wsRef.current = null;
        // Exponential backoff reconnect
        const delay = Math.min(1000 * 2 ** retryCountRef.current, 30000);
        retryCountRef.current += 1;
        retryTimerRef.current = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // WS not supported or other error
    }
  }, [user, invalidateAll, qc]);

  useEffect(() => {
    connect();

    // Ping every 25s to keep alive
    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 25000);

    return () => {
      clearInterval(pingInterval);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);
}

"use client";

import { useEffect, useRef, useState } from "react";

import { apiClient } from "@/lib/api-client";
import { ExecutionPath } from "@/lib/flow-types";

type Status = "loading" | "success" | "error";

/** Used only as a fallback when EventSource is unavailable (e.g. SSR, old browser). */
const AI_POLL_INTERVAL_MS = 2000;

export interface UseExecutionPathsResult {
  paths: ExecutionPath[];
  status: Status;
  aiEnriching: boolean;
}

export function useExecutionPaths(): UseExecutionPathsResult {
  const [paths, setPaths] = useState<ExecutionPath[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [aiEnriching, setAiEnriching] = useState(false);

  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let cancelled = false;

    // ------------------------------------------------------------------
    // Fallback: interval-poll /status until AI enrichment finishes, then
    // re-fetch paths. Used when EventSource is not available.
    // ------------------------------------------------------------------
    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const startFallbackPolling = () => {
      stopPolling();
      pollRef.current = setInterval(async () => {
        try {
          const { aiEnriching: enriching } = await apiClient.getStatus();
          if (!enriching) {
            setAiEnriching(false);
            stopPolling();
            const fetched = await apiClient.getPaths();
            if (!cancelled) setPaths(fetched);
          }
        } catch {
          stopPolling();
          setAiEnriching(false);
        }
      }, AI_POLL_INTERVAL_MS);
    };

    // ------------------------------------------------------------------
    // SSE connection — primary path
    // ------------------------------------------------------------------
    const connectSSE = () => {
      const es = apiClient.openEventStream();
      esRef.current = es;

      es.addEventListener("status", (e: MessageEvent) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(e.data) as { aiEnriching: boolean };
          setAiEnriching(data.aiEnriching);
        } catch {
          /* malformed frame — ignore */
        }
      });

      es.addEventListener("paths-updated", (e: MessageEvent) => {
        if (cancelled) return;
        try {
          const data = JSON.parse(e.data) as ExecutionPath[];
          setPaths(data);
          setStatus("success");
        } catch {
          /* malformed frame — ignore */
        }
      });

      es.addEventListener("rebuild-start", () => {
        if (cancelled) return;
        setStatus("loading");
      });

      es.onerror = () => {
        // SSE stream closed or server unreachable — close and fall back to polling.
        es.close();
        esRef.current = null;
        if (!cancelled) startFallbackPolling();
      };
    };

    // ------------------------------------------------------------------
    // Initialization: fetch initial state, then subscribe to live updates
    // ------------------------------------------------------------------
    const init = async () => {
      try {
        const [fetched, { aiEnriching: enriching }] = await Promise.all([
          apiClient.getPaths(),
          apiClient.getStatus(),
        ]);

        if (cancelled) return;

        setPaths(fetched);
        setStatus("success");
        setAiEnriching(enriching);

        // Connect SSE for all future pushes (paths rebuild, AI status, file-change).
        if (typeof EventSource !== "undefined") {
          connectSSE();
        } else if (enriching) {
          // No EventSource support (rare) — poll until AI enrichment finishes.
          startFallbackPolling();
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    init();

    return () => {
      cancelled = true;
      esRef.current?.close();
      esRef.current = null;
      stopPolling();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { paths, status, aiEnriching };
}

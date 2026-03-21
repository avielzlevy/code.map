"use client";

import { useEffect, useRef, useState } from "react";

import { apiClient } from "@/lib/api-client";
import { ExecutionPath } from "@/lib/flow-types";

type Status = "loading" | "success" | "error";

const AI_POLL_INTERVAL_MS = 2000;

interface UseExecutionPathsResult {
  paths: ExecutionPath[];
  status: Status;
  aiEnriching: boolean;
}

export function useExecutionPaths(): UseExecutionPathsResult {
  const [paths, setPaths] = useState<ExecutionPath[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [aiEnriching, setAiEnriching] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchPaths = async () => {
    const fetched = await apiClient.getPaths();
    setPaths(fetched);
    setStatus("success");
  };

  const stopPolling = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPolling = () => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const { aiEnriching: enriching } = await apiClient.getStatus();
        if (!enriching) {
          setAiEnriching(false);
          stopPolling();
          await fetchPaths();
        }
      } catch {
        // status endpoint unavailable — stop polling silently
        stopPolling();
        setAiEnriching(false);
      }
    }, AI_POLL_INTERVAL_MS);
  };

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        await fetchPaths();
        if (cancelled) return;

        const { aiEnriching: enriching } = await apiClient.getStatus();
        if (cancelled) return;

        if (enriching) {
          setAiEnriching(true);
          startPolling();
        }
      } catch {
        if (!cancelled) setStatus("error");
      }
    };

    init();

    return () => {
      cancelled = true;
      stopPolling();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { paths, status, aiEnriching };
}

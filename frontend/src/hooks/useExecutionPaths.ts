"use client";

import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";
import { ExecutionPath, MOCK_PATHS } from "@/lib/mockData";

type Status = "loading" | "success" | "error";

interface UseExecutionPathsResult {
  paths: ExecutionPath[];
  status: Status;
  usingMockData: boolean;
}

export function useExecutionPaths(): UseExecutionPathsResult {
  const [paths, setPaths] = useState<ExecutionPath[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [usingMockData, setUsingMockData] = useState(false);

  useEffect(() => {
    let cancelled = false;

    apiClient
      .getPaths()
      .then((fetched) => {
        if (cancelled) return;
        if (fetched.length === 0) {
          setPaths(MOCK_PATHS);
          setUsingMockData(true);
        } else {
          setPaths(fetched);
        }
        setStatus("success");
      })
      .catch(() => {
        if (cancelled) return;
        // Sidecar unreachable (dev without backend running) — fall back to mock data
        setPaths(MOCK_PATHS);
        setUsingMockData(true);
        setStatus("success");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { paths, status, usingMockData };
}

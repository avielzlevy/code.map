"use client";

import { useEffect, useState } from "react";

import { apiClient } from "@/lib/api-client";
import { ExecutionPath } from "@/lib/mockData";

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
        setPaths(fetched);
        setStatus("success");
      })
      .catch(() => {
        if (cancelled) return;
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { paths, status, usingMockData };
}

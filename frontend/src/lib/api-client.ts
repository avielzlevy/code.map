import { ExecutionPath } from "@/lib/mockData";

/**
 * Base URL of the FlowMap sidecar server.
 *
 * In development: set NEXT_PUBLIC_API_URL=http://localhost:4567 in .env.local
 * In production (served from sidecar): leave unset — calls are same-origin.
 */
const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ?? "";

interface ApiResponse<T> {
  status: "success" | "error";
  data: T;
}

async function request<T>(path: string, timeoutMs = 6000): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`[api-client] ${path} → HTTP ${res.status}`);
    }

    const body: ApiResponse<T> = await res.json();

    if (body.status === "error") {
      throw new Error(`[api-client] ${path} → server returned error`);
    }

    return body.data;
  } finally {
    clearTimeout(timer);
  }
}

export const apiClient = {
  getPaths(): Promise<ExecutionPath[]> {
    return request<ExecutionPath[]>("/api/flow-map/paths");
  },

  healthCheck(): Promise<{ alive: boolean }> {
    return request<{ alive: boolean }>("/api/flow-map/health");
  },

  getStatus(): Promise<{ aiEnriching: boolean }> {
    return request<{ aiEnriching: boolean }>("/api/flow-map/status");
  },
};

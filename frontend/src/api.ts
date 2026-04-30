import type { Bill, BillUpdate, BillsResponse, Stats, MonthlyResponse, SortOption } from "./types";

const BASE = "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers);
  if (!headers.has("Content-Type") && !(options?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

export const api = {
  getBills: (params: {
    category?: string;
    search?: string;
    sort?: SortOption;
    page?: number;
    page_size?: number;
  }) => {
    const q = new URLSearchParams();
    if (params.category && params.category !== "all") q.set("category", params.category);
    if (params.search) q.set("search", params.search);
    if (params.sort) q.set("sort", params.sort);
    if (params.page) q.set("page", String(params.page));
    if (params.page_size) q.set("page_size", String(params.page_size));
    return request<BillsResponse>(`/api/bills?${q}`);
  },

  getBill: (id: number) => request<Bill>(`/api/bills/${id}`),

  updateBill: (id: number, update: BillUpdate) =>
    request<Bill>(`/api/bills/${id}`, {
      method: "PUT",
      body: JSON.stringify(update),
    }),

  getStats: () => request<Stats>("/api/stats"),

  getMonthly: () => request<MonthlyResponse>("/api/monthly"),

  uploadReceipts: (files: FileList) => {
    const form = new FormData();
    Array.from(files).forEach((f) => form.append("files", f));
    return request<{ uploaded: number; files: string[] }>("/api/upload", {
      method: "POST",
      body: form,
    });
  },

  imageUrl: (filename: string) => `${BASE}/api/images/${encodeURIComponent(filename)}`,
};

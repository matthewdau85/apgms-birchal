import type { BankLine, BankLineResponse, Category, LineFilters } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";
const DEFAULT_ORG_ID = import.meta.env.VITE_ORG_ID ?? "";

interface FetchOptions extends RequestInit {
  orgId?: string;
}

async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const headers = new Headers(options.headers ?? {});

  if (API_KEY && !headers.has("x-api-key")) {
    headers.set("x-api-key", API_KEY);
  }

  const orgId = options.orgId ?? DEFAULT_ORG_ID;
  if (orgId && !headers.has("x-org-id")) {
    headers.set("x-org-id", orgId);
  }

  if (!(options.body instanceof FormData) && options.method && options.method !== "GET") {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json()) as T;
  return data;
}

export interface ListBankLinesInput extends LineFilters {
  cursor?: string | null;
  take?: number;
}

export async function listBankLines(input: ListBankLinesInput): Promise<BankLineResponse> {
  const params = new URLSearchParams();
  if (input.take) params.set("take", String(input.take));
  if (input.cursor) params.set("cursor", input.cursor);
  if (input.from) params.set("from", input.from);
  if (input.to) params.set("to", input.to);
  if (input.payee) params.set("payee", input.payee);
  if (input.cleared) params.set("cleared", input.cleared);

  const orgId = input.orgId || DEFAULT_ORG_ID;
  if (orgId) params.set("orgId", orgId);
  const query = params.toString();
  const path = `/bank-lines${query ? `?${query}` : ""}`;
  return apiFetch<BankLineResponse>(path, { method: "GET", orgId });
}

export async function importBankLinesCsv(orgId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("file", file);
  await apiFetch("/bank-lines/import", {
    method: "POST",
    body: formData,
    orgId,
  });
}

export interface UpdateBankLineInput {
  notes?: string | null;
  cleared?: boolean;
  categoryId?: string | null;
}

export async function updateBankLine(
  id: string,
  orgId: string,
  body: UpdateBankLineInput,
): Promise<BankLine> {
  return apiFetch<BankLine>(`/bank-lines/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
    orgId,
  });
}

export async function listCategories(orgId: string): Promise<Category[]> {
  try {
    const result = await apiFetch<{ categories: Category[] }>("/categories", {
      method: "GET",
      orgId,
    });
    return result.categories ?? [];
  } catch (error) {
    console.warn("Failed to load categories", error);
    return [];
  }
}

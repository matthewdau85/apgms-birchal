import type { OnboardingDraftData } from "../onboarding/types";

const DEFAULT_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
};

const API_BASE: string = (globalThis as { API_BASE_URL?: string }).API_BASE_URL ?? "";

type DraftResponse = {
  token: string;
  orgId?: string | null;
  data: OnboardingDraftData;
  updatedAt: string;
};

type CompleteResponse = {
  token: string;
  status: string;
  completedAt: string;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      ...DEFAULT_HEADERS,
      ...(init.headers ?? {}),
    },
  });

  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch (error) {
      body = undefined;
    }
    throw new ApiError(
      `Request to ${path} failed with status ${response.status}`,
      response.status,
      body
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function fetchDraft(token: string): Promise<DraftResponse> {
  return request(`/onboarding/draft/${token}`, { method: "GET" });
}

export async function saveDraft(payload: {
  token?: string | null;
  orgId?: string | null;
  data: OnboardingDraftData;
}): Promise<DraftResponse> {
  const prepared = {
    ...payload,
    token: payload.token ?? undefined,
    orgId: payload.orgId ?? undefined,
    data: JSON.parse(JSON.stringify(payload.data ?? {})),
  };

  return request(`/onboarding/draft`, {
    method: "POST",
    body: JSON.stringify(prepared),
  });
}

export async function completeOnboarding(payload: {
  token: string;
  data: OnboardingDraftData;
}): Promise<CompleteResponse> {
  return request(`/onboarding/complete`, {
    method: "POST",
    body: JSON.stringify({
      token: payload.token,
      data: JSON.parse(JSON.stringify(payload.data ?? {})),
    }),
  });
}

export type DashboardSummary = {
  totalDeposits: number;
  totalWithdrawals: number;
  netCash: number;
  openCases: number;
};

export type DashboardDailyMetric = {
  date: string;
  balance: number;
};

export type DashboardResponse = {
  summary: DashboardSummary;
  dailyBalances: DashboardDailyMetric[];
};

export type BankLine = {
  id: string;
  name: string;
  amount: number;
  status: "pending" | "verified" | "flagged";
  updatedAt: string;
};

export type BankLinesResponse = {
  items: BankLine[];
  nextCursor?: string | null;
};

export type OnboardingProfileRequest = {
  legalName: string;
  abn: string;
  contactEmail: string;
};

export type OnboardingBankRequest = {
  bsb: string;
  accountNumber: string;
};

export type OnboardingPolicyRequest = {
  policyId: string;
};

declare global {
  interface Window {
    __APGMS_API_BASE__?: string;
  }
}

const BASE_URL = (typeof window !== "undefined" && window.__APGMS_API_BASE__) || "";

function getAuthToken(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem("apgms:token");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers || {});
  headers.set("Accept", "application/json");
  if (!(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const token = getAuthToken();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    ...init,
    headers,
  });

  if (!response.ok) {
    const message = await safeParseError(response);
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function safeParseError(response: Response): Promise<string> {
  try {
    const data = await response.json();
    if (data && typeof data.message === "string") {
      return data.message;
    }
  } catch (error) {
    // ignore json parsing errors
  }
  return response.statusText || "Request failed";
}

export const api = {
  dashboard(): Promise<DashboardResponse> {
    return request<DashboardResponse>("/dashboard").catch(() => mockDashboardResponse);
  },
  bankLines(params: { cursor?: string | null; take?: number } = {}): Promise<BankLinesResponse> {
    const search = new URLSearchParams();
    if (params.cursor) {
      search.set("cursor", params.cursor);
    }
    if (typeof params.take === "number") {
      search.set("take", String(params.take));
    }
    const query = search.toString();
    return request<BankLinesResponse>(`/bank-lines${query ? `?${query}` : ""}`).catch(() =>
      getMockBankLines(params.cursor, params.take),
    );
  },
  verifyAudit(payload: { id: string }): Promise<void> {
    return request<void>("/audit/rpt/verify", {
      method: "POST",
      body: JSON.stringify(payload),
    }).catch(() => undefined);
  },
  onboarding: {
    updateProfile(payload: OnboardingProfileRequest): Promise<void> {
      return request<void>("/onboarding/profile", {
        method: "PATCH",
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    },
    connectBank(payload: OnboardingBankRequest): Promise<void> {
      return request<void>("/onboarding/bank", {
        method: "POST",
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    },
    selectPolicy(payload: OnboardingPolicyRequest): Promise<void> {
      return request<void>("/onboarding/policy", {
        method: "POST",
        body: JSON.stringify(payload),
      }).catch(() => undefined);
    },
  },
};

export type ApiClient = typeof api;

const mockDashboardResponse: DashboardResponse = {
  summary: {
    totalDeposits: 152000,
    totalWithdrawals: 98000,
    netCash: 54000,
    openCases: 3,
  },
  dailyBalances: Array.from({ length: 30 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (29 - index));
    return {
      date: date.toISOString(),
      balance: 40000 + Math.sin(index / 4) * 5000 + index * 400,
    };
  }),
};

const mockBankLines: BankLine[] = Array.from({ length: 18 }).map((_, index) => {
  const date = new Date();
  date.setDate(date.getDate() - index);
  const statuses: BankLine["status"][] = ["pending", "verified", "flagged"];
  return {
    id: `mock-${index + 1}`,
    name: `Settlement ${index + 1}`,
    amount: index % 3 === 0 ? 4200 + index * 52 : 1800 + index * 25,
    status: statuses[index % statuses.length],
    updatedAt: date.toISOString(),
  };
});

function getMockBankLines(cursor?: string | null, take = 10): BankLinesResponse {
  const start = Number(cursor ?? 0);
  const offset = Number.isFinite(start) ? start : 0;
  const items = mockBankLines.slice(offset, offset + take);
  const nextOffset = offset + items.length;
  const next = nextOffset < mockBankLines.length ? String(nextOffset) : null;
  return {
    items,
    nextCursor: next,
  };
}

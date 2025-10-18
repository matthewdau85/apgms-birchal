const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

function normalizePath(path: string) {
  const trimmedBase = API_URL.replace(/\/$/, '');
  const trimmedPath = path.replace(/^\//, '');
  return `${trimmedBase}/${trimmedPath}`;
}

export type ApiError = Error & { status?: number };

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? window.localStorage.getItem('token') : null;
  const headers = new Headers(init?.headers ?? {});

  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (init?.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(normalizePath(path), {
    ...init,
    headers
  });

  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = await response.json();
      if (typeof data?.message === 'string') {
        message = data.message;
      }
    } catch (error) {
      console.warn('Failed to parse error response', error);
    }

    const error = new Error(message) as ApiError;
    error.status = response.status;
    throw error;
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

export type PaginatedResponse<T> = {
  items: T[];
  nextCursor?: string | null;
  total?: number;
};

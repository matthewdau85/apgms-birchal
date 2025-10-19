const baseURL = import.meta.env.VITE_API_URL ?? '';

type ApiOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  signal?: AbortSignal;
  authToken?: string | null;
  searchParams?: Record<string, string | number | boolean | undefined>;
};

const encodeSearchParams = (
  params: Record<string, string | number | boolean | undefined> | undefined,
) => {
  if (!params) return '';
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    usp.set(key, String(value));
  });
  const query = usp.toString();
  return query ? `?${query}` : '';
};

const normalizeError = async (response: Response) => {
  try {
    const data = await response.json();
    const message = data?.message || data?.error || response.statusText;
    return new Error(message || 'Request failed');
  } catch (err) {
    return new Error(response.statusText || 'Request failed');
  }
};

export const apiFetch = async <T>(path: string, options: ApiOptions = {}): Promise<T> => {
  const { method = 'GET', headers = {}, body, signal, authToken, searchParams } = options;
  const query = encodeSearchParams(searchParams);
  const url = `${baseURL}${path}${query}`;
  const nextHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...headers,
  };
  if (!(body instanceof FormData) && body !== undefined) {
    nextHeaders['Content-Type'] = 'application/json';
  }
  if (authToken) {
    nextHeaders['Authorization'] = `Bearer ${authToken}`;
  }

  const response = await fetch(url, {
    method,
    headers: nextHeaders,
    body:
      body !== undefined && !(body instanceof FormData)
        ? JSON.stringify(body)
        : (body as BodyInit | null),
    signal,
    credentials: 'include',
  });

  if (!response.ok) {
    throw await normalizeError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

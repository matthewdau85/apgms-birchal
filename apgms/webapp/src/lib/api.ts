export type FetchJsonOptions = RequestInit & {
  headers?: HeadersInit;
};

function createHeaders(init?: FetchJsonOptions): Headers {
  const headers = new Headers(init?.headers);
  headers.set('Accept', 'application/json');
  return headers;
}

export async function fetchJson<T>(input: RequestInfo | URL, init?: FetchJsonOptions): Promise<T> {
  const headers = createHeaders(init);
  if (typeof window !== 'undefined' && !headers.has('Authorization')) {
    const token = window.localStorage.getItem('devToken') ?? '';
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(input, { ...init, headers });

  if (response.status === 401 && typeof window !== 'undefined') {
    window.location.assign('/login');
    throw new Error('Unauthorized');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

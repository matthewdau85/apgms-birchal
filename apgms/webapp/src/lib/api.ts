const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 200;

const apiBaseUrl = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/+$/, '/') ?? '';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveUrl = (path: string): string => {
  try {
    return new URL(path, apiBaseUrl || window.location.origin).toString();
  } catch (error) {
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.error('Failed to resolve request URL', error);
    }
    throw error;
  }
};

const shouldRetry = (status: number) => status >= 500 && status < 600;

export type ApiFetch = (path: string, init?: RequestInit) => Promise<Response>;

export const apiFetch: ApiFetch = async (path, init) => {
  const url = resolveUrl(path);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, init);

      if (!shouldRetry(response.status) || attempt === MAX_ATTEMPTS) {
        return response;
      }

      const backoffMs = BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(backoffMs);
    } catch (error) {
      if (attempt === MAX_ATTEMPTS) {
        throw error;
      }

      const backoffMs = BASE_DELAY_MS * 2 ** (attempt - 1);
      await sleep(backoffMs);
    }
  }

  throw new Error('Failed to execute request');
};

export type FetchJSONOptions = RequestInit & {
  ignoreStatuses?: number[];
};

export async function fetchJSON<T>(input: RequestInfo, options: FetchJSONOptions = {}): Promise<T | null> {
  const { ignoreStatuses = [], headers, ...init } = options;
  const response = await fetch(input, {
    headers: {
      'Content-Type': 'application/json',
      ...(headers || {})
    },
    ...init
  });

  if (ignoreStatuses.includes(response.status)) {
    return null;
  }

  if (!response.ok) {
    const message = await safeReadText(response);
    throw new Error(message || response.statusText);
  }

  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return (await response.json()) as T;
  }

  return null;
}

async function safeReadText(response: Response) {
  try {
    return await response.text();
  } catch (error) {
    console.error('Failed to read response text', error);
    return '';
  }
}

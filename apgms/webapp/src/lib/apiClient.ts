export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions<TBody = unknown> {
  method?: HttpMethod;
  body?: TBody;
  headers?: HeadersInit;
}

const DEFAULT_HEADERS: HeadersInit = {
  'Content-Type': 'application/json'
};

export class ApiClient {
  private readonly baseUrl: string;

  constructor(baseUrl: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3000') {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  async request<TResponse>(endpoint: string, options: RequestOptions = {}): Promise<TResponse> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: { ...DEFAULT_HEADERS, ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `Request failed with status ${response.status}`);
    }

    if (response.status === 204) {
      return undefined as TResponse;
    }

    return (await response.json()) as TResponse;
  }
}

export const apiClient = new ApiClient();

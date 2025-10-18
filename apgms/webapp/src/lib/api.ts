import axios, { AxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

type RequestConfig<T> = AxiosRequestConfig<T>;

async function request<T>(config: RequestConfig<T>): Promise<T> {
  const response = await api.request<T>(config);
  return response.data;
}

export async function get<T>(url: string, config?: RequestConfig<T>): Promise<T> {
  return request<T>({ ...(config ?? {}), method: 'GET', url });
}

export async function post<T>(url: string, data?: unknown, config?: RequestConfig<T>): Promise<T> {
  return request<T>({ ...(config ?? {}), method: 'POST', url, data });
}

export async function patch<T>(url: string, data?: unknown, config?: RequestConfig<T>): Promise<T> {
  return request<T>({ ...(config ?? {}), method: 'PATCH', url, data });
}

export async function remove<T>(url: string, config?: RequestConfig<T>): Promise<T> {
  return request<T>({ ...(config ?? {}), method: 'DELETE', url });
}

export type BankLinesParams = {
  orgId: string;
  take?: number;
  cursor?: string;
};

export async function getDashboard<T = unknown>() {
  return get<T>('/dashboard');
}

export async function getBankLines<T = unknown>(params: BankLinesParams) {
  return get<T>('/bank-lines', { params });
}

export async function getRptByLine<T = unknown>(id: string) {
  return get<T>(`/bank-lines/${id}/reports`);
}

export { api };

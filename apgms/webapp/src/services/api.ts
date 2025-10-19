import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_BASE_URL =
  (typeof import.meta !== 'undefined' ? (import.meta as any).env?.VITE_API_BASE_URL : undefined) ||
  process.env.REACT_APP_API_BASE_URL ||
  'http://localhost:8080/api';

let isRefreshing = false;
let failedQueue: Array<{ resolve: (v?: unknown) => void; reject: (e?: any) => void }> = [];

const processQueue = (error: Error | null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve()));
  failedQueue = [];
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  if (token) {
    (config.headers as any).Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as AxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original?._retry) {
      original._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => failedQueue.push({ resolve, reject }))
          .then(() => api(original))
          .catch((e) => Promise.reject(e));
      }

      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) {
          throw new Error('no-refresh-token');
        }

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
        localStorage.setItem('authToken', data.accessToken);
        localStorage.setItem('refreshToken', data.refreshToken);
        processQueue(null);
        return api(original);
      } catch (e) {
        processQueue(e as Error);
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/login';
        return Promise.reject(e);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export const dashboardAPI = {
  generateReport: (req: { reportType: string; startDate: string; endDate: string }) =>
    api.post('/dashboard/generate-report', req),
  downloadReport: (reportId: string, extra?: any) =>
    api.get(`/dashboard/report/${reportId}/download`, { responseType: 'blob', ...(extra || {}) }),
};

export default api;

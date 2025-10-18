import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = window.localStorage.getItem('session-token');
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`);
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.warn('Session expired');
    }
    return Promise.reject(error);
  },
);

export type ApiError = {
  message: string;
  statusCode?: number;
  errors?: Record<string, string[]>;
};

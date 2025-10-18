import axios from 'axios';

export const api = axios.create({
  baseURL: 'http://localhost:3000'
});

export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.message ??
      error.response?.statusText ??
      error.message ??
      'Unexpected network error'
    );
  }

  return 'Unexpected error';
};

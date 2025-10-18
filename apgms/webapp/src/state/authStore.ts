import { create } from 'zustand';
import { apiClient } from '@/api/client';
import type { AuthResponse, User } from '@/api/types';

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'error';

export interface AuthState {
  user: User | null;
  status: AuthStatus;
  error: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  register: (payload: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: 'idle',
  error: null,
  login: async (credentials) => {
    set({ status: 'loading', error: null });
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      set({ user: response.user, status: 'authenticated', error: null });
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Unable to login' });
    }
  },
  register: async (payload) => {
    set({ status: 'loading', error: null });
    try {
      const response = await apiClient.post<AuthResponse>('/auth/register', payload);
      set({ user: response.user, status: 'authenticated', error: null });
    } catch (error) {
      set({ status: 'error', error: error instanceof Error ? error.message : 'Unable to register' });
    }
  },
  logout: () => set({ user: null, status: 'idle', error: null }),
}));

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import AppShell from './shell/AppShell';
import DashboardRoute from './routes';
import BankLinesRoute from './routes/bank-lines';
import './index.css';

const queryClient = new QueryClient();

if (import.meta.env.DEV && typeof window !== 'undefined') {
  import('./dev/axe');
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<DashboardRoute />} />
            <Route path="/bank-lines" element={<BankLinesRoute />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);

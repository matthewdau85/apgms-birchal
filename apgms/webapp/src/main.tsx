import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { AppProviders, AppRouter } from './router';
import { ThemeProvider } from './theme/theme-provider';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </ThemeProvider>
  </React.StrictMode>
);

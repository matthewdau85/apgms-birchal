import React from 'react';
import ReactDOM from 'react-dom/client';

import { ErrorBoundary } from './shell/ErrorBoundary';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Failed to find the root element');
}

const AppRoutes = () => (
  <main>
    <h1>APGMS Web Application</h1>
  </main>
);

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  </React.StrictMode>,
);

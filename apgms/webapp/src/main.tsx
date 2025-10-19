import React from 'react';
import { createRoot } from 'react-dom/client';
import ReportsPage from './pages/ReportsPage';

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ReportsPage />
    </React.StrictMode>,
  );
}

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './routes/App';
import { ThemeProvider } from './styles/ThemeProvider';
import './styles/global.css';

if (import.meta.env.PROD) {
  const suppressed: Array<keyof Console> = ['log', 'debug'];
  suppressed.forEach((method) => {
    const original = console[method];
    console[method] = (...args: unknown[]) => {
      if (!import.meta.env.DEV) return;
      original.apply(console, args as []);
    };
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
);

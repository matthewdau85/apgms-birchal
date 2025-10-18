import React from 'react';
import ReactDOM from 'react-dom/client';
import { Outlet, RouterProvider, createBrowserRouter } from 'react-router-dom';
import DashboardRoute from './routes/index';
import BankLinesRoute from './routes/bank-lines';
import { AppSidebar } from './shell/Sidebar';
import { AppHeader } from './shell/Header';
import { ThemeProvider } from './shell/ThemeProvider';
import { MobileSidebar } from './shell/MobileSidebar';
import './index.css';

const router = createBrowserRouter([
  {
    element: (
      <AppLayout>
        <Outlet />
      </AppLayout>
    ),
    children: [
      { index: true, element: <DashboardRoute /> },
      { path: 'bank-lines', element: <BankLinesRoute /> }
    ]
  }
]);

function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  return (
    <ThemeProvider>
      <a
        href="#main-content"
        className="absolute left-4 top-4 z-50 -translate-y-16 rounded bg-indigo-600 px-4 py-2 text-sm font-semibold text-white focus:translate-y-0 focus:outline-none"
      >
        Skip to main content
      </a>
      <div className="min-h-screen bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <div className="flex min-h-screen">
          <MobileSidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
          <AppSidebar />
          <div className="flex flex-1 flex-col">
            <AppHeader onToggleMobileNav={() => setMobileNavOpen(true)} />
            <main className="flex-1 overflow-y-auto p-4 sm:p-6" id="main-content">
              {children}
            </main>
          </div>
        </div>
      </div>
    </ThemeProvider>
  );
}

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Root element #root not found');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

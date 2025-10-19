import { Outlet, createRootRoute } from "@tanstack/react-router";
import { QueryClientProvider, QueryClient } from "@tanstack/react-query";
import { Suspense, useMemo } from "react";
import { AuthProvider } from "../lib/auth";
import { RouterDevtools } from "@tanstack/router-devtools";

const queryClient = new QueryClient();

export const rootRoute = createRootRoute({
  component: () => {
    const devtools = useMemo(() => {
      if (import.meta.env.DEV) {
        return <RouterDevtools />;
      }
      return null;
    }, []);

    return (
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <div className="min-h-screen bg-slate-50 text-slate-900">
            <Suspense fallback={<div className="p-6">Loading…</div>}>
              <Outlet />
            </Suspense>
          </div>
          {devtools}
        </QueryClientProvider>
      </AuthProvider>
    );
  },
});

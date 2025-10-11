import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as React from 'react';
import { ThemeProvider } from '@/components/theme/theme-provider';
import { TooltipProvider } from '@/components/ui/tooltip';

const queryClient = new QueryClient();

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={null}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </React.Suspense>
  );
}

import { useState, type ReactNode } from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Topbar } from '@/components/layout/Topbar';
import { Breadcrumbs } from '@/components/navigation/Breadcrumbs';
import { NAVIGATION_ROUTES } from '@/routes/config';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      <Sidebar onNavigate={closeMobile} />
      <MobileSidebar isOpen={mobileOpen} onNavigate={closeMobile} />
      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar onToggleSidebar={() => setMobileOpen(!mobileOpen)} />
        <main className="flex-1 space-y-6 bg-muted/30 px-4 py-6 sm:px-6 lg:px-8">
          <Breadcrumbs />
          {children}
        </main>
      </div>
    </div>
  );
}

interface MobileSidebarProps {
  isOpen: boolean;
  onNavigate: () => void;
}

function MobileSidebar({ isOpen, onNavigate }: MobileSidebarProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        'fixed inset-0 z-40 flex transform flex-col bg-background/80 backdrop-blur-sm transition-all duration-200 ease-in-out lg:hidden',
        isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
      )}
      role="dialog"
      aria-modal="true"
      aria-hidden={!isOpen}
    >
      <div className="w-72 max-w-[80%] bg-card shadow-xl">
        <div className="flex h-16 items-center gap-3 border-b border-border px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold" aria-hidden>
            AP
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">APGMS Platform</p>
            <p className="text-xs text-muted-foreground">Compliance made clear</p>
          </div>
        </div>
        <nav aria-label="Mobile" className="flex flex-col gap-1 px-3 py-4">
          {NAVIGATION_ROUTES.map(route => (
            <NavLink
              key={route.path}
              to={route.path === '/onboarding' ? '/onboarding' : route.path}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                )
              }
            >
              <route.icon className="h-4 w-4" aria-hidden />
              <span>{t(route.translationKey)}</span>
            </NavLink>
          ))}
        </nav>
        <Button type="button" variant="ghost" className="w-full rounded-none" onClick={onNavigate}>
          Close
        </Button>
      </div>
      <button className="flex-1" onClick={onNavigate} aria-label="Close navigation" />
    </div>
  );
}

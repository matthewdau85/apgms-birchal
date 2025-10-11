import { NavLink } from 'react-router-dom';
import { NAVIGATION_ROUTES } from '@/routes/config';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface SidebarProps {
  onNavigate?: () => void;
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { t } = useTranslation();

  return (
    <aside className="hidden border-r border-border bg-card/40 lg:flex lg:w-64 lg:flex-col lg:justify-between">
      <div>
        <div className="flex h-16 items-center gap-2 border-b border-border px-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground font-semibold" aria-hidden>
            AP
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">APGMS Platform</p>
            <p className="text-xs text-muted-foreground">Compliance made clear</p>
          </div>
        </div>
        <nav aria-label="Main" className="flex flex-col gap-1 px-3 py-4">
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
      </div>
      <div className="px-6 py-4 text-xs text-muted-foreground">
        <p className="font-medium">Need help?</p>
        <p>Reach out to your APGMS onboarding specialist any time.</p>
      </div>
    </aside>
  );
}

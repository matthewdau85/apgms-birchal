import { useState } from 'react';
import { Link, Outlet, useRouterState } from '@tanstack/react-router';
import { Banknote, LayoutDashboard, Menu } from 'lucide-react';

import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/bank-lines', label: 'Bank Lines', icon: Banknote },
];

function useActivePath() {
  const { location } = useRouterState();
  return location.href;
}

function SidebarNav({ className, onNavigate }: { className?: string; onNavigate?: () => void }) {
  const activePath = useActivePath();

  return (
    <nav className={cn('flex flex-1 flex-col gap-1', className)}>
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive =
          activePath === item.to || (item.to !== '/' && activePath.startsWith(`${item.to}/`));
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground',
              isActive ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
            )}
          >
            <Icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function DesktopSidebar() {
  return (
    <aside className="hidden w-64 flex-col border-r bg-card/40 p-4 md:flex">
      <div className="mb-6 flex items-center gap-2 text-lg font-semibold">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          AP
        </span>
        APGMS Portal
      </div>
      <SidebarNav />
    </aside>
  );
}

function MobileSidebar({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="border-b">
          <SheetTitle className="px-6 py-4 text-left text-base font-semibold">
            APGMS Navigation
          </SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 px-4 py-6">
          <SidebarNav
            onNavigate={() => {
              onOpenChange(false);
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function AppShell() {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <DesktopSidebar />
      <MobileSidebar open={open} onOpenChange={setOpen} />
      <div className="flex flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setOpen(true)}
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <span className="text-base font-semibold md:hidden">APGMS Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-muted/10 p-6">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

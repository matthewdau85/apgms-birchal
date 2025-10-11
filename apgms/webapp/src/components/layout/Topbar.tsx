import { useState } from 'react';
import { Menu, Bell, HelpCircle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useTranslation } from 'react-i18next';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface TopbarProps {
  onToggleSidebar: () => void;
}

const NOTIFICATIONS = [
  {
    id: '1',
    title: 'Submission received',
    description: 'ATO acknowledged your March BAS lodgement.'
  },
  {
    id: '2',
    title: 'Evidence approved',
    description: 'Lease agreement uploaded by Samuels Finance.'
  }
];

export function Topbar({ onToggleSidebar }: TopbarProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <header className="flex h-16 items-center justify-between gap-4 border-b border-border bg-background px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <Button type="button" variant="ghost" size="icon" className="lg:hidden" onClick={onToggleSidebar} aria-label="Toggle navigation">
          <Menu className="h-5 w-5" aria-hidden />
        </Button>
        <OrgSwitcher />
      </div>
      <div className="flex flex-1 items-center justify-end gap-2 sm:gap-4">
        <label className="relative hidden w-full max-w-sm items-center gap-2 rounded-md border border-input px-3 py-2 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 md:flex">
          <Search className="h-4 w-4 text-muted-foreground" aria-hidden />
          <span className="sr-only">{t('topbar.search')}</span>
          <Input
            className="border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
            placeholder={t('topbar.search')}
            value={searchQuery}
            onChange={event => setSearchQuery(event.target.value)}
          />
        </label>
        <Button type="button" variant="ghost" size="icon" className="md:hidden" aria-label={t('topbar.search')}>
          <Search className="h-4 w-4" aria-hidden />
        </Button>
        <TooltipHelp />
        <NotificationsMenu />
        <ThemeToggle />
        <ProfileMenu />
      </div>
    </header>
  );
}

function OrgSwitcher() {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" aria-hidden />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-600" aria-hidden />
          </span>
          <span className="hidden text-sm font-medium sm:inline">{t('orgs.primary')}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="start">
        <DropdownMenuLabel>Switch organisation</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>{t('orgs.primary')}</DropdownMenuItem>
        <DropdownMenuItem>{t('orgs.secondary')}</DropdownMenuItem>
        <DropdownMenuItem>{t('orgs.tertiary')}</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TooltipHelp() {
  const { t } = useTranslation();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={t('topbar.help')}>
          <HelpCircle className="h-4 w-4" aria-hidden />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <span>{t('topbar.help')}</span>
      </TooltipContent>
    </Tooltip>
  );
}

function NotificationsMenu() {
  const { t } = useTranslation();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={t('topbar.notifications')}>
          <Bell className="h-4 w-4" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">{t('topbar.notifications')}</p>
          <p className="text-xs text-muted-foreground">Stay on top of key compliance activities.</p>
        </div>
        <ScrollArea className="max-h-64">
          <ul className="divide-y divide-border">
            {NOTIFICATIONS.map(item => (
              <li key={item.id} className="px-4 py-3 text-sm">
                <p className="font-medium text-foreground">{item.title}</p>
                <p className="text-muted-foreground">{item.description}</p>
              </li>
            ))}
          </ul>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

function ProfileMenu() {
  const { t } = useTranslation();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" className="flex items-center gap-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback aria-label={t('topbar.profile')}>JD</AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium md:inline">Jordan Diaz</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48" align="end">
        <DropdownMenuLabel>{t('topbar.profile')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem>View profile</DropdownMenuItem>
        <DropdownMenuItem>Account settings</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem>Log out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

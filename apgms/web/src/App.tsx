import React, { useMemo, useState } from 'react';
import { Layout, Navigation, Header, RPTDrawer } from './components';
import { BankLineSummary } from './components/RPTDrawer';
import { DashboardPage, BankLinesPage } from './pages';
import { ThemeProvider } from './theme/ThemeProvider';
import { defaultTheme } from './theme/theme';

type PageId = 'dashboard' | 'bank-lines';

type PageDefinition = {
  id: PageId;
  label: string;
  subtitle: string;
  icon: string;
};

const pages: PageDefinition[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    subtitle: 'Liquidity runway and counterparty health at a glance',
    icon: '📊',
  },
  {
    id: 'bank-lines',
    label: 'Bank Lines',
    subtitle: 'Risk participation terms, utilisation and next actions',
    icon: '🏦',
  },
];

export const App = () => {
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [selectedLine, setSelectedLine] = useState<BankLineSummary | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const currentPage = useMemo(
    () => pages.find((page) => page.id === activePage) ?? pages[0],
    [activePage]
  );

  const navigationItems = useMemo(
    () =>
      pages.map((page) => ({
        id: page.id,
        label: page.label,
        icon: page.icon,
        badge: page.id === 'bank-lines' ? 'Live' : undefined,
      })),
    []
  );

  const renderPage = () => {
    if (activePage === 'dashboard') {
      return <DashboardPage />;
    }

    return (
      <BankLinesPage
        onSelectLine={(line) => {
          setSelectedLine(line);
          setDrawerOpen(true);
        }}
      />
    );
  };

  return (
    <ThemeProvider>
      <Layout
        navigation={
          <Navigation
            items={navigationItems}
            activeItemId={activePage}
            onSelect={(id) => {
              setActivePage(id as PageId);
              setDrawerOpen(false);
            }}
          />
        }
        header={
          <Header
            title={currentPage.label}
            subtitle={currentPage.subtitle}
            actions={
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 999,
                  border: 'none',
                  background: defaultTheme.colors.primary,
                  color: '#02040B',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Create brief
              </button>
            }
          />
        }
        drawer={<RPTDrawer bankLine={selectedLine} onClose={() => setDrawerOpen(false)} />}
        isDrawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      >
        {renderPage()}
      </Layout>
    </ThemeProvider>
  );
};

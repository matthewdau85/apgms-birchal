import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Layout, Navigation, Header, RPTDrawer } from '../components';
import { ThemeProvider } from '../theme/ThemeProvider';

describe('Layout', () => {
  const renderLayout = () =>
    render(
      <ThemeProvider>
        <Layout
          navigation={
            <Navigation
              items={[
                { id: 'dashboard', label: 'Dashboard', icon: '📊' },
                { id: 'bank-lines', label: 'Bank Lines', icon: '🏦' },
              ]}
              activeItemId="dashboard"
              onSelect={() => undefined}
            />
          }
          header={<Header title="Dashboard" subtitle="Liquidity overview" />}
          drawer={<RPTDrawer bankLine={null} onClose={() => undefined} />}
          isDrawerOpen
          onCloseDrawer={() => undefined}
        >
          <div>Content</div>
        </Layout>
      </ThemeProvider>
    );

  it('renders navigation items and content', () => {
    renderLayout();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Bank Lines')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('shows the drawer headline', () => {
    renderLayout();
    fireEvent.click(screen.getByText('Close'));
    expect(screen.getByText('RPT Insights')).toBeInTheDocument();
  });
});

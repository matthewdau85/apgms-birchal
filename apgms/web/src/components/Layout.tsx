import React, { ReactNode } from 'react';
import { useTheme } from '../theme/ThemeProvider';

type LayoutProps = {
  navigation: ReactNode;
  header: ReactNode;
  children: ReactNode;
  drawer?: ReactNode;
  isDrawerOpen?: boolean;
  onCloseDrawer?: () => void;
};

export const Layout = ({
  navigation,
  header,
  children,
  drawer,
  isDrawerOpen,
  onCloseDrawer,
}: LayoutProps) => {
  const theme = useTheme();

  return (
    <div
      style={{
        backgroundColor: theme.colors.background,
        color: theme.colors.textPrimary,
        fontFamily: theme.typography.fontFamily,
        minHeight: '100vh',
        display: 'grid',
        gridTemplateColumns: '260px 1fr',
      }}
    >
      <aside
        style={{
          borderRight: `1px solid ${theme.colors.border}`,
          padding: theme.spacing.lg,
          background: theme.colors.surface,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.spacing.lg,
        }}
      >
        <div
          style={{
            fontSize: theme.typography.headings.h3.size,
            fontWeight: theme.typography.headings.h3.weight,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: theme.colors.textSecondary,
          }}
        >
          APGMS
        </div>
        {navigation}
      </aside>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          minHeight: '100vh',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <header
          style={{
            padding: `${theme.spacing.lg}px ${theme.spacing.xl}px`,
            borderBottom: `1px solid ${theme.colors.border}`,
            background: theme.colors.surface,
            position: 'sticky',
            top: 0,
            zIndex: 2,
          }}
        >
          {header}
        </header>
        <main
          style={{
            flex: 1,
            padding: theme.spacing.xl,
            background: theme.colors.surfaceAlt,
          }}
        >
          {children}
        </main>
      </div>

      {drawer && (
        <div
          aria-hidden={!isDrawerOpen}
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: isDrawerOpen ? 'auto' : 'none',
            display: 'flex',
            justifyContent: 'flex-end',
            zIndex: 3,
          }}
        >
          <div
            role="presentation"
            onClick={onCloseDrawer}
            style={{
              flex: 1,
              backgroundColor: 'rgba(4, 7, 21, 0.6)',
              opacity: isDrawerOpen ? 1 : 0,
              transition: 'opacity 180ms ease',
            }}
          />
          <aside
            style={{
              width: 400,
              maxWidth: '90vw',
              background: theme.colors.surface,
              borderLeft: `1px solid ${theme.colors.border}`,
              transform: isDrawerOpen ? 'translateX(0)' : 'translateX(100%)',
              transition: 'transform 180ms ease',
              boxShadow: theme.shadows.raised,
              height: '100%',
              overflowY: 'auto',
            }}
          >
            {drawer}
          </aside>
        </div>
      )}
    </div>
  );
};

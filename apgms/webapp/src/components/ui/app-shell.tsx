import type { PropsWithChildren, ReactNode } from 'react';

interface AppShellProps extends PropsWithChildren {
  navigation: ReactNode;
}

export function AppShell({ navigation, children }: AppShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">{navigation}</aside>
      <main className="main-content">
        <header className="app-header">
          <h1 className="app-title">BIRChal Assurance Console</h1>
          <p className="app-subtitle">
            Operational controls, reconciliations, and anomaly triage for APGMS.
          </p>
        </header>
        <section className="app-body" aria-live="polite">
          {children}
        </section>
      </main>
    </div>
  );
}

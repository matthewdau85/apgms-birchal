import React, { useMemo, useState, useId } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence, motion } from 'framer-motion';

type Kpi = {
  id: string;
  label: string;
  value: string;
  change: string;
};

type Row = {
  id: string;
  investor: string;
  amount: string;
  status: 'Pending' | 'Completed' | 'Failed';
  date: string;
};

type NavItem = {
  id: string;
  label: string;
  icon: React.ReactNode;
};

const kpis: Kpi[] = [
  {
    id: 'committed-capital',
    label: 'Committed capital',
    value: '$8.2M',
    change: '+4.7% vs last quarter',
  },
  {
    id: 'active-investors',
    label: 'Active investors',
    value: '128',
    change: '+12 new in last 30 days',
  },
  {
    id: 'avg-ticket',
    label: 'Average ticket size',
    value: '$64,100',
    change: '+$3,400 vs forecast',
  },
];

const navItems: NavItem[] = [
  {
    id: 'overview',
    label: 'Overview',
    icon: (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 13.5 12 4l9 9.5M4.5 12V20h5v-5h5v5h5v-8"
        />
      </svg>
    ),
  },
  {
    id: 'investors',
    label: 'Investors',
    icon: (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17 20v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2m18 0v-2a4 4 0 0 0-3-3.87M9 7a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm10 4a4 4 0 1 0-8 0 4 4 0 0 0 8 0Z"
        />
      </svg>
    ),
  },
  {
    id: 'workflow',
    label: 'Workflow',
    icon: (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m17 3 4 4-4 4m4-4H10a4 4 0 0 0-4 4v1m0 9-4-4 4-4m-4 4h11a4 4 0 0 0 4-4v-1"
        />
      </svg>
    ),
  },
  {
    id: 'documents',
    label: 'Documents',
    icon: (
      <svg
        aria-hidden="true"
        className="h-5 w-5"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M19.5 8h-15m0 0L7.5 3m-3 5 3 5m12-5 3 5-3 5m3-5h-15m0 0 3.5 5m-3.5-5 3.5-5"
        />
      </svg>
    ),
  },
];

const rows: Row[] = [
  {
    id: 'row-1',
    investor: 'Aurora Ventures',
    amount: '$250,000',
    status: 'Completed',
    date: '2024-02-12',
  },
  {
    id: 'row-2',
    investor: 'Pioneer Group',
    amount: '$180,000',
    status: 'Pending',
    date: '2024-02-18',
  },
  {
    id: 'row-3',
    investor: 'Latitude Angels',
    amount: '$95,000',
    status: 'Completed',
    date: '2024-02-22',
  },
  {
    id: 'row-4',
    investor: 'Northern Lights',
    amount: '$120,000',
    status: 'Failed',
    date: '2024-02-28',
  },
];

const statusColors: Record<Row['status'], string> = {
  Completed: 'text-emerald-400 bg-emerald-400/10 ring-1 ring-emerald-400/40',
  Pending: 'text-amber-400 bg-amber-400/10 ring-1 ring-amber-400/40',
  Failed: 'text-rose-400 bg-rose-400/10 ring-1 ring-rose-400/40',
};

const numericStyle = { fontVariantNumeric: 'tabular-nums' as const };

function Sidebar() {
  return (
    <aside className="flex flex-col gap-6 border-r border-slate-800 bg-slate-950/70 p-4 backdrop-blur">
      <div className="flex items-center justify-center sm:justify-start">
        <span className="text-lg font-semibold tracking-tight text-slate-100">APGMS</span>
      </div>
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <SidebarItem key={item.id} item={item} />
        ))}
      </nav>
    </aside>
  );
}

function SidebarItem({ item }: { item: NavItem }) {
  const tooltipId = useId();

  return (
    <button
      type="button"
      className="group relative flex items-center justify-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-300 transition-colors hover:bg-slate-800/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500 sm:justify-start"
      aria-describedby={tooltipId}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-900 text-slate-200 ring-1 ring-inset ring-slate-700/70">
        {item.icon}
      </span>
      <span className="hidden sm:inline text-left">{item.label}</span>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute left-full top-1/2 hidden -translate-y-1/2 translate-x-3 whitespace-nowrap rounded-md bg-slate-900/95 px-2 py-1 text-xs font-medium text-slate-100 shadow-lg ring-1 ring-black/20 group-focus-visible:inline group-hover:inline sm:hidden"
      >
        {item.label}
      </span>
    </button>
  );
}

function Header({ onToggleDrawer }: { onToggleDrawer: () => void }) {
  return (
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/40 px-6 py-4 backdrop-blur">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Portfolio</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-white">Growth Management</h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-full bg-slate-900/90 px-4 py-2 text-sm font-medium text-slate-200 shadow-inner shadow-white/5 ring-1 ring-slate-700/60 transition-colors hover:bg-slate-800"
        >
          Export report
        </button>
        <button
          type="button"
          onClick={onToggleDrawer}
          className="rounded-full bg-sky-500 px-4 py-2 text-sm font-semibold text-slate-950 shadow-lg shadow-sky-500/30 transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300"
        >
          Insights
        </button>
      </div>
    </header>
  );
}

function KpiCards() {
  return (
    <section aria-label="Key performance indicators" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {kpis.map((kpi, index) => (
        <motion.article
          key={kpi.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08, duration: 0.4, ease: 'easeOut' }}
          className="flex flex-col gap-3 rounded-2xl border border-slate-800/60 bg-slate-900/60 p-6 text-slate-200 shadow-lg shadow-black/20 backdrop-blur"
        >
          <p className="text-sm font-medium text-slate-400">{kpi.label}</p>
          <p className="text-3xl font-semibold tracking-tight text-white" style={numericStyle}>
            {kpi.value}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-400">{kpi.change}</p>
        </motion.article>
      ))}
    </section>
  );
}

function ActivityTable() {
  const data = useMemo(() => rows, []);

  return (
    <section className="rounded-2xl border border-slate-800/60 bg-slate-900/60 shadow-lg shadow-black/20 backdrop-blur">
      <header className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Latest activity</h2>
          <p className="text-sm text-slate-400">Recent investor commitments and settlement status.</p>
        </div>
        <button
          type="button"
          className="rounded-full border border-slate-700/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition-colors hover:bg-slate-800"
        >
          View all
        </button>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
          <thead className="bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th scope="col" className="px-6 py-3">Investor</th>
              <th scope="col" className="px-6 py-3" style={numericStyle}>
                Amount committed
              </th>
              <th scope="col" className="px-6 py-3">Status</th>
              <th scope="col" className="px-6 py-3" style={numericStyle}>
                Commitment date
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {data.map((row) => (
              <tr key={row.id} className="transition hover:bg-slate-800/40">
                <td className="px-6 py-4 text-sm font-medium text-white">{row.investor}</td>
                <td className="px-6 py-4 text-sm" style={numericStyle}>
                  {row.amount}
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${statusColors[row.status]}`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-300" style={numericStyle}>
                  {row.date}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function InsightsDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close insights"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-slate-950/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label="Insights drawer"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col gap-6 border-l border-slate-800 bg-slate-950/95 p-8 text-slate-200 shadow-2xl shadow-slate-900/80 backdrop-blur"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
          >
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Insights</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Capital pipeline outlook</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-slate-900/70 p-2 text-slate-300 ring-1 ring-slate-800 transition hover:bg-slate-800 hover:text-white"
              >
                <span className="sr-only">Close</span>
                <svg
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m6 6 12 12M6 18 18 6" />
                </svg>
              </button>
            </header>
            <div className="space-y-6 text-sm leading-relaxed text-slate-300">
              <p>
                Commitments are trending <span className="text-emerald-400">18% above target</span> with strongest
                momentum from strategic funds in the last two weeks.
              </p>
              <p>
                Conversion from warm introductions to signed term sheets improved from <span style={numericStyle}>42%</span> to{' '}
                <span style={numericStyle}>55%</span> after the revised onboarding flow.
              </p>
              <p>
                Focus outreach on <span className="font-semibold text-white">LatAm family offices</span> where pipeline velocity
                remains <span style={numericStyle}>2.6x</span> higher than the global average.
              </p>
            </div>
            <div className="mt-auto flex flex-col gap-3 rounded-xl border border-slate-800/60 bg-slate-900/60 p-4">
              <h3 className="text-sm font-semibold text-white">Next actions</h3>
              <ul className="flex list-disc flex-col gap-2 pl-4 text-sm text-slate-300">
                <li>Schedule follow-ups with top three pending investors.</li>
                <li>Refresh investor briefing deck with updated KPIs.</li>
                <li>Coordinate compliance review for new fund structure.</li>
              </ul>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function App() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-2 py-6 sm:px-6 lg:flex-row lg:gap-8">
        <div className="sticky top-6 z-10 flex-shrink-0 rounded-3xl border border-slate-800/60 bg-slate-950/80 shadow-xl shadow-black/30 backdrop-blur lg:h-[calc(100vh-3rem)] lg:w-64">
          <Sidebar />
        </div>
        <main className="flex-1 space-y-6 rounded-3xl border border-slate-800/60 bg-slate-950/70 shadow-xl shadow-black/30 backdrop-blur">
          <Header onToggleDrawer={() => setDrawerOpen(true)} />
          <div className="space-y-6 px-6 pb-8">
            <KpiCards />
            <ActivityTable />
          </div>
        </main>
      </div>
      <InsightsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}

const container = document.getElementById('root');

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

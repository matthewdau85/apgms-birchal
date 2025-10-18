import type {
  AuthResponse,
  AtoLodgement,
  BankLine,
  DashboardSummary,
  PaymentApproval,
  ReconciliationTask,
  User,
} from './types';

export type ApiHandler = <T>(path: string, options: RequestInit & { body?: unknown }) => Promise<T>;

const mockUser: User = {
  id: 'user-1',
  name: 'Alex Analyst',
  email: 'alex.analyst@example.com',
  role: 'analyst',
};

const bankLines: BankLine[] = [
  {
    id: 'bl-001',
    accountName: 'Operating Account',
    balance: 154230.45,
    currency: 'AUD',
    status: 'healthy',
    lastUpdated: '2024-03-08T08:30:00Z',
  },
  {
    id: 'bl-002',
    accountName: 'Trust Account',
    balance: 40210.12,
    currency: 'AUD',
    status: 'warning',
    lastUpdated: '2024-03-08T08:15:00Z',
  },
  {
    id: 'bl-003',
    accountName: 'ATO Clearing',
    balance: -5210.67,
    currency: 'AUD',
    status: 'attention',
    lastUpdated: '2024-03-08T07:50:00Z',
  },
];

const reconciliationTasks: ReconciliationTask[] = [
  {
    id: 'rec-001',
    description: 'Match Stripe settlement for March 5',
    status: 'in-progress',
    assignedTo: 'Jamie Chen',
    dueDate: '2024-03-09',
  },
  {
    id: 'rec-002',
    description: 'Investigate duplicate payment from Birchal Pty Ltd',
    status: 'pending',
    assignedTo: 'Pat Riley',
    dueDate: '2024-03-11',
  },
  {
    id: 'rec-003',
    description: 'Reconcile interest accrual for trust account',
    status: 'completed',
    assignedTo: 'Alex Analyst',
    dueDate: '2024-03-07',
  },
];

const paymentApprovals: PaymentApproval[] = [
  {
    id: 'pay-001',
    vendor: 'Cloud Services Co.',
    amount: 1280,
    currency: 'AUD',
    status: 'pending',
    submittedAt: '2024-03-07T12:00:00Z',
    approver: 'Alex Analyst',
  },
  {
    id: 'pay-002',
    vendor: 'Regulatory Fees',
    amount: 540,
    currency: 'AUD',
    status: 'approved',
    submittedAt: '2024-03-06T09:20:00Z',
    approver: 'Jamie Chen',
  },
  {
    id: 'pay-003',
    vendor: 'Marketing Agency',
    amount: 3200,
    currency: 'AUD',
    status: 'pending',
    submittedAt: '2024-03-05T15:45:00Z',
    approver: 'Pat Riley',
  },
];

const atoLodgements: AtoLodgement[] = [
  {
    id: 'ato-001',
    period: 'BAS Q1 2024',
    status: 'lodged',
    lodgedAt: '2024-02-21',
    dueDate: '2024-02-28',
  },
  {
    id: 'ato-002',
    period: 'PAYG March 2024',
    status: 'pending',
    lodgedAt: null,
    dueDate: '2024-03-21',
  },
  {
    id: 'ato-003',
    period: 'SGC FY24',
    status: 'overdue',
    lodgedAt: null,
    dueDate: '2024-03-01',
  },
];

const getSummary = (): DashboardSummary => ({
  bankLinesCount: bankLines.length,
  reconciliationsInProgress: reconciliationTasks.filter((task) => task.status !== 'completed').length,
  pendingApprovals: paymentApprovals.filter((approval) => approval.status === 'pending').length,
  lodgementsDue: atoLodgements.filter((lodgement) => lodgement.status !== 'lodged').length,
});

const parseBody = (body: unknown) => {
  if (typeof body === 'string') {
    return body ? JSON.parse(body) : {};
  }

  if (body instanceof FormData) {
    return Object.fromEntries(body.entries());
  }

  return (body as Record<string, unknown>) ?? {};
};

const defaultHandler: ApiHandler = async (path, options) => {
  const method = (options.method ?? 'GET').toUpperCase();

  switch (path) {
    case '/auth/login': {
      const body = parseBody(options.body);
      const email = String(body.email ?? mockUser.email);
      const name = email.split('@')[0]?.replace(/[-_.]/g, ' ') ?? mockUser.name;
      const user: User = {
        ...mockUser,
        email,
        name: name.replace(/\b\w/g, (char) => char.toUpperCase()),
      };
      return { user } as AuthResponse;
    }
    case '/auth/register': {
      const body = parseBody(options.body);
      const user: User = {
        id: 'user-registered',
        name: String(body.name ?? mockUser.name),
        email: String(body.email ?? mockUser.email),
        role: 'viewer',
      };
      return { user } as AuthResponse;
    }
    case '/bank-lines':
      return bankLines as unknown as BankLine[];
    case '/reconciliation':
      return reconciliationTasks as unknown as ReconciliationTask[];
    case '/payments/approvals':
      return paymentApprovals as unknown as PaymentApproval[];
    case '/ato/status':
      return atoLodgements as unknown as AtoLodgement[];
    case '/dashboard/summary':
      return getSummary() as DashboardSummary;
    default:
      throw new Error(`No mock handler implemented for path: ${path}`);
  }
};

let handler: ApiHandler = defaultHandler;

export const setApiHandler = (customHandler?: ApiHandler) => {
  handler = customHandler ?? defaultHandler;
};

export const apiClient = {
  async get<T>(path: string, init?: RequestInit) {
    return handler<T>(path, { ...(init ?? {}), method: 'GET' });
  },
  async post<T>(path: string, body: unknown, init?: RequestInit) {
    return handler<T>(path, {
      ...(init ?? {}),
      method: 'POST',
      body: typeof body === 'string' ? body : JSON.stringify(body ?? {}),
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
    });
  },
};

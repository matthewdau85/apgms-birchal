export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'analyst' | 'viewer';
}

export interface AuthResponse {
  user: User;
}

export interface BankLine {
  id: string;
  accountName: string;
  balance: number;
  currency: string;
  status: 'healthy' | 'warning' | 'attention';
  lastUpdated: string;
}

export interface ReconciliationTask {
  id: string;
  description: string;
  status: 'completed' | 'in-progress' | 'pending';
  assignedTo: string;
  dueDate: string;
}

export interface PaymentApproval {
  id: string;
  vendor: string;
  amount: number;
  currency: string;
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: string;
  approver: string;
}

export interface AtoLodgement {
  id: string;
  period: string;
  status: 'lodged' | 'pending' | 'overdue';
  lodgedAt: string | null;
  dueDate: string;
}

export interface DashboardSummary {
  bankLinesCount: number;
  reconciliationsInProgress: number;
  pendingApprovals: number;
  lodgementsDue: number;
}

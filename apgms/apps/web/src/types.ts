export interface BankLine {
  id: string;
  orgId: string;
  date: string;
  amount: number;
  payee: string;
  description?: string | null;
  notes?: string | null;
  cleared?: boolean | null;
  categoryId?: string | null;
  categoryName?: string | null;
}

export interface BankLineResponse {
  lines: BankLine[];
  nextCursor?: string | null;
}

export interface Category {
  id: string;
  name: string;
}

export interface LineFilters {
  orgId: string;
  from?: string;
  to?: string;
  payee?: string;
  cleared?: "true" | "false" | "";
}

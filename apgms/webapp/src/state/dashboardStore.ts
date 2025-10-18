import { create } from 'zustand';

export interface DashboardState {
  selectedBankLineId: string | null;
  approvedPayments: string[];
  selectBankLine: (id: string) => void;
  togglePaymentApproval: (id: string) => void;
}

export const useDashboardStore = create<DashboardState>((set) => ({
  selectedBankLineId: null,
  approvedPayments: [],
  selectBankLine: (id) => set({ selectedBankLineId: id }),
  togglePaymentApproval: (id) =>
    set((state) => {
      const isApproved = state.approvedPayments.includes(id);
      return {
        approvedPayments: isApproved
          ? state.approvedPayments.filter((item) => item !== id)
          : [...state.approvedPayments, id],
      };
    }),
}));

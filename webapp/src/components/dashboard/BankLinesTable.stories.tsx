import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { axe } from 'jest-axe';
import { BankLinesTable } from './BankLinesTable';
import type { BankLine } from '../../data/dashboardData';

const SAMPLE_DATA: BankLine[] = [
  {
    id: '1',
    bank: 'First Pacific',
    product: 'Warehouse',
    limit: 120_000_000,
    utilized: 78_500_000,
    rptStatus: 'pending',
    updatedAt: new Date().toISOString()
  },
  {
    id: '2',
    bank: 'Union Trust',
    product: 'Revolver',
    limit: 95_000_000,
    utilized: 61_200_000,
    rptStatus: 'verified',
    updatedAt: new Date(Date.now() - 86400000 * 5).toISOString()
  }
];

const meta: Meta<typeof BankLinesTable> = {
  title: 'Dashboard/Bank Lines Table',
  component: BankLinesTable,
  args: {
    data: SAMPLE_DATA,
    onVerify: async () => {}
  }
};

export default meta;

type Story = StoryObj<typeof BankLinesTable>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByRole('table')).toBeInTheDocument();
    const results = await axe(canvasElement);
    expect(results).toHaveNoViolations();
  }
};

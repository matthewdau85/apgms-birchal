import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { axe } from 'jest-axe';
import { KpiSummaryCard } from './KpiSummaryCard';

const meta: Meta<typeof KpiSummaryCard> = {
  title: 'Dashboard/KPI Summary Card',
  component: KpiSummaryCard,
  args: {
    summary: {
      label: 'Outstanding Balance',
      value: '$378M',
      delta: '+3.4% MoM',
      direction: 'up'
    }
  },
  parameters: {
    backgrounds: { default: 'light' }
  }
};

export default meta;

type Story = StoryObj<typeof KpiSummaryCard>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText('$378M')).toBeInTheDocument();
    const results = await axe(canvasElement);
    expect(results).toHaveNoViolations();
  }
};

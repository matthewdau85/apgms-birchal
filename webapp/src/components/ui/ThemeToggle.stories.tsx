import type { Meta, StoryObj } from '@storybook/react';
import { expect, within } from '@storybook/test';
import { axe } from 'jest-axe';
import { ThemeToggle } from './ThemeToggle';
import { ThemeProvider } from '../../styles/ThemeProvider';

const meta: Meta<typeof ThemeToggle> = {
  title: 'Primitives/Theme Toggle',
  component: ThemeToggle,
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    )
  ]
};

export default meta;

type Story = StoryObj<typeof ThemeToggle>;

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getByText(/Theme/i)).toBeInTheDocument();
    const results = await axe(canvasElement);
    expect(results).toHaveNoViolations();
  }
};

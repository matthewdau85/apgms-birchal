import type { Preview } from '@storybook/react';
import { expect } from '@storybook/test';
import { toHaveNoViolations } from 'jest-axe';
import '../src/styles/global.css';
import { ThemeProvider } from '../src/styles/ThemeProvider';

expect.extend(toHaveNoViolations);

const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/
      }
    }
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <div style={{ padding: '2rem', background: 'var(--color-surface)' }}>
          <Story />
        </div>
      </ThemeProvider>
    )
  ]
};

export default preview;

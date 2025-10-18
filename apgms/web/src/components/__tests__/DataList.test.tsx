import { render, screen, waitFor } from '@testing-library/react';
import { axe } from 'jest-axe';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { DataList } from '../DataList.js';

const items = [
  { id: '1', label: 'First event' },
  { id: '2', label: 'Second event' },
];

describe('DataList', () => {
  it('renders skeletons while loading', () => {
    render(
      <DataList
        items={[]}
        isLoading
        renderItem={(item) => <span>{item as string}</span>}
      />,
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.getAllByRole('presentation').length).toBeGreaterThan(0);
  });

  it('renders empty state when no items are available', () => {
    render(
      <DataList
        items={[]}
        renderItem={(item) => <span>{item as string}</span>}
        emptyMessage={{
          title: 'No transactions yet',
          description: 'Start by connecting an account.',
        }}
      />,
    );

    expect(screen.getByRole('status', { name: /no transactions yet/i })).toBeInTheDocument();
    expect(screen.getByText(/start by connecting an account/i)).toBeVisible();
  });

  it('renders provided items', () => {
    render(
      <DataList
        items={items}
        getKey={(item) => item.id}
        renderItem={(item) => <span>{item.label}</span>}
      />,
    );

    items.forEach((item) => {
      expect(screen.getByText(item.label)).toBeInTheDocument();
    });
  });

  it('shows an accessible error message when renderItem throws', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      render(
        <DataList
          items={items}
          getKey={(item) => item.id}
          renderItem={() => {
            throw new Error('boom');
          }}
        />,
      );

      expect(
        screen.getByText(/an unexpected error occurred while rendering this list/i),
      ).toBeInTheDocument();
    } finally {
      consoleSpy.mockRestore();
    }
  });

  it('passes axe accessibility checks', async () => {
    const { container } = render(
      <DataList
        items={items}
        getKey={(item) => item.id}
        renderItem={(item) => <span>{item.label}</span>}
      />,
    );

    const results = await axe(container);
    await waitFor(() => expect(results).toHaveNoViolations());
  });
});

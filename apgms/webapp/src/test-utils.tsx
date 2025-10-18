import type { PropsWithChildren, ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

export const renderWithRouter = (
  ui: ReactElement,
  { initialEntries = ['/'] }: { initialEntries?: string[] } = {}
) => {
  const Wrapper = ({ children }: PropsWithChildren) => (
    <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
  );

  return render(ui, { wrapper: Wrapper });
};

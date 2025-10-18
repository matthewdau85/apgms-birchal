# Frontend Architecture

## Technology stack
- [Vite](https://vitejs.dev/) for the application shell and rapid development experience.
- React 18 with React Router for client-side rendering and routing.
- CSS Modules + CSS variables to implement the design system and light/dark theming.
- Recharts to visualise 30-day time-series data on the dashboard.
- TanStack Table to power the sortable/paginatable Bank Lines grid.
- Focus Trap + accessible patterns for all interactive overlays.
- Storybook for component-level documentation and regression coverage.
- Playwright with axe-core for automated accessibility assertions.

## Theming & design tokens
The theming system is declared in `src/styles/global.css` using CSS custom properties. Users can pick between light, dark, and system modes. When “system” is selected we defer to `prefers-color-scheme` media queries. The selected value is persisted in `localStorage`, and the resolved theme is exposed through `ThemeProvider`. All components reference semantic tokens (e.g. `--color-surface`, `--color-accent`) instead of hard-coded colours.

## Layout primitives
`AppLayout` defines the shell (sidebar + main content). Layout primitives are built with CSS Grid/Flexbox and responsive breakpoints to accommodate small screens. Components such as `Card`, `Button`, and the KPI/Chart wrappers compose these primitives.

## Dashboard UX states
`useDashboardData` centralises data fetching. Consumers render:
- Skeleton placeholders while `status === 'loading'`.
- `ErrorState` with retry affordance when `status === 'error'`.
- `EmptyState` when no dashboard data is available.

The Bank Lines table includes optimistic verification updates: the UI flips to “Verified” immediately, while the fake network call resolves.

## Accessibility & interaction notes
- Overlays (verify modal) use `focus-trap-react`, `aria-modal`, escape handling, and close on backdrop click. Keyboard focus is preserved and controls are reachable.
- All buttons include focus-visible styles.
- Table headers expose sorting controls via `<button>` with accessible labels.
- Loading states announce progress via `aria-live` regions.
- Storybook stories define `play` functions that run automated axe checks via `@storybook/test`.
- Playwright suite under `webapp/tests` starts Vite, navigates to the dashboard, and runs `axe` checks plus keyboard navigation assertions.

## Testing
Scripts are defined in `webapp/package.json`:
- `npm run test:playwright` runs end-to-end a11y checks.
- `npm run storybook` spins up component documentation.
- `npm run build` builds both TypeScript and the production bundle.

Refer to `webapp/tests` for guidance on Playwright environment setup.

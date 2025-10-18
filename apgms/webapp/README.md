# APGMS Webapp

The APGMS web client is a React + TypeScript single-page application that surfaces onboarding,
tax workflow, and compliance dashboards backed by the platform's API Gateway.

## Getting started

Install dependencies from the repository root using [pnpm](https://pnpm.io/):

```bash
pnpm install
```

### Available scripts

```bash
pnpm --filter @apgms/webapp dev       # Start the Vite development server with hot module reload
pnpm --filter @apgms/webapp test      # Run unit and component tests via Vitest
pnpm --filter @apgms/webapp lint      # Lint the source with ESLint
pnpm --filter @apgms/webapp build     # Create a production build
pnpm --filter @apgms/webapp preview   # Preview the production build locally
pnpm --filter @apgms/webapp typecheck # Validate TypeScript types without emitting files
```

The development server defaults to `http://localhost:5173`.

### Environment configuration

The app expects an API Gateway base URL exposed as `VITE_API_BASE_URL`. Create a `.env.local`
file inside `apgms/webapp` for local development:

```
VITE_API_BASE_URL=http://localhost:8080
```

When not provided the app falls back to `/api`, making it compatible with the platform's reverse
proxy configuration.

### API integration

All API communication flows through `src/services/api.ts`, which automatically attaches bearer
tokens and converts non-2xx responses into JavaScript errors. The Zustand store coordinates
authentication and hydration logic so components only render when portal data is available.

### Project layout

- `src/App.tsx` – top-level routing configuration for onboarding, tax workflows, and compliance views.
- `src/store/appStore.ts` – Zustand store handling authentication, portal data, and API interactions.
- `src/pages/*` – page-level views composing layout primitives and store state.
- `src/components` – shared layout and UI elements.
- `src/styles.css` – global styling for the glassmorphic layout.
- `tests` live alongside the modules they cover under `__tests__` directories.

### Testing

Vitest powers both unit and component tests. The suite includes:

- Store tests validating authentication bootstrapping and onboarding updates.
- Component tests covering form validation and user actions.

End-to-end coverage can be layered on with Playwright. A stub configuration lives in
`apgms/playwright.config.ts`; add scenarios under `tests/e2e` and wire them into CI when API stubs are ready.

### Continuous integration

The repository ships with a GitHub Actions workflow (`.github/workflows/webapp.yml`) that installs
workspace dependencies and runs linting, type checks, tests, and production builds for the webapp.

### Deployment

Run `pnpm --filter @apgms/webapp build` to produce an optimized bundle in `dist/`. Serve the output
behind the platform's CDN or a static hosting provider. Ensure that server-side routing rewrites
all requests to `index.html` so React Router can resolve client-side routes.

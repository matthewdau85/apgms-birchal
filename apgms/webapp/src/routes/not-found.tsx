import { Link } from '@tanstack/react-router';

export default function NotFoundRoute() {
  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col items-center justify-center gap-6 text-center">
      <div className="rounded-full bg-primary-100 px-4 py-1 text-sm font-medium text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
        404 — Page not found
      </div>
      <h1 className="text-3xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="max-w-xl text-balance text-base text-slate-600 dark:text-slate-300">
        The page you&apos;re looking for doesn&apos;t exist or may have been moved. Use the navigation to find your way back.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2 font-medium text-white transition hover:bg-primary-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950"
      >
        Return to dashboard
      </Link>
    </div>
  );
}

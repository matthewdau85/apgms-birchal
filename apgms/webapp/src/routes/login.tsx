import { createRoute, Link } from "@tanstack/react-router";
import { rootRoute } from "./__root";
import { useAuth } from "../lib/auth";

export const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/login",
  component: LoginPage,
});

function LoginPage() {
  const { login } = useAuth();

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-3xl font-semibold">Welcome back</h1>
      <p className="text-slate-600">
        This demo login instantly authenticates you to continue onboarding.
      </p>
      <button
        type="button"
        onClick={login}
        className="rounded-lg bg-sky-600 px-6 py-3 text-white shadow transition hover:bg-sky-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600"
      >
        Continue to Onboarding
      </button>
      <Link
        to="/onboarding"
        className="text-sm text-sky-700 underline decoration-dotted underline-offset-4"
      >
        Skip to onboarding
      </Link>
    </main>
  );
}

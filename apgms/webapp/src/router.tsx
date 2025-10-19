import { RootRoute, Route, Router } from "@tanstack/react-router";
import { RootShell } from "./routes/__root";
import { OnboardingLayout } from "./routes/onboarding/_layout";
import { OnboardingOrgStep } from "./routes/onboarding/org";
import { OnboardingBankStep } from "./routes/onboarding/bank";
import { OnboardingPoliciesStep } from "./routes/onboarding/policies";
import { OnboardingIntegrationsStep } from "./routes/onboarding/integrations";
import { OnboardingReviewStep } from "./routes/onboarding/review";

const rootRoute = new RootRoute({
  component: RootShell,
});

const onboardingRoute = new Route({
  getParentRoute: () => rootRoute,
  path: "onboarding",
  component: OnboardingLayout,
});

const onboardingIndexRoute = new Route({
  getParentRoute: () => onboardingRoute,
  path: "/",
  component: OnboardingOrgStep,
});

const onboardingOrgRoute = new Route({
  getParentRoute: () => onboardingRoute,
  path: "org",
  component: OnboardingOrgStep,
});

const onboardingBankRoute = new Route({
  getParentRoute: () => onboardingRoute,
  path: "bank",
  component: OnboardingBankStep,
});

const onboardingPoliciesRoute = new Route({
  getParentRoute: () => onboardingRoute,
  path: "policies",
  component: OnboardingPoliciesStep,
});

const onboardingIntegrationsRoute = new Route({
  getParentRoute: () => onboardingRoute,
  path: "integrations",
  component: OnboardingIntegrationsStep,
});

const onboardingReviewRoute = new Route({
  getParentRoute: () => onboardingRoute,
  path: "review",
  component: OnboardingReviewStep,
});

const routeTree = rootRoute.addChildren([
  onboardingRoute.addChildren([
    onboardingIndexRoute,
    onboardingOrgRoute,
    onboardingBankRoute,
    onboardingPoliciesRoute,
    onboardingIntegrationsRoute,
    onboardingReviewRoute,
  ]),
]);

export const router = new Router({
  routeTree,
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

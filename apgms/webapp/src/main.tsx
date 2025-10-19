import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { AppShell } from "./shell/AppShell";
import DashboardRoute from "./routes";
import BankLinesRoute from "./routes/bank-lines";
import OnboardingRoute from "./routes/onboarding";

const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <DashboardRoute /> },
      { path: "bank-lines", element: <BankLinesRoute /> },
      { path: "onboarding", element: <OnboardingRoute /> },
    ],
  },
]);

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element with id 'root' not found");
}

const root = createRoot(rootElement);
root.render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);

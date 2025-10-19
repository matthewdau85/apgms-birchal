import { Outlet } from "@tanstack/react-router";
import React from "react";

export function RootShell() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-blue-600"
      >
        Skip to main content
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-blue-500">
              APGMS
            </p>
            <h1 className="text-xl font-semibold text-slate-900">
              Getting Started
            </h1>
          </div>
          <div aria-live="polite" className="text-sm text-slate-500">
            Secure onboarding wizard
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-6 py-10">
        <Outlet />
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-4 text-xs text-slate-500">
          &copy; {new Date().getFullYear()} APGMS. All rights reserved.
        </div>
      </footer>
    </div>
  );
}

import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";

type Theme = "light" | "dark";

const NAV_ITEMS: Array<{ to: string; label: string }> = [
  { to: "/", label: "Dashboard" },
  { to: "/bank-lines", label: "Bank Lines" },
  { to: "/onboarding", label: "Onboarding" },
];

function getInitialTheme(): Theme {
  if (typeof window === "undefined") {
    return "light";
  }

  const stored = window.localStorage.getItem("apgms:theme") as Theme | null;
  if (stored === "light" || stored === "dark") {
    return stored;
  }

  if (window.matchMedia?.("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }

  return "light";
}

function applyTheme(theme: Theme) {
  if (typeof document === "undefined") {
    return;
  }

  document.documentElement.dataset.theme = theme;
  document.body.style.backgroundColor = theme === "dark" ? "#111" : "#f7f7f7";
  document.body.style.color = theme === "dark" ? "#f1f5f9" : "#0f172a";
}

export function AppShell({ children }: { children?: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const location = useLocation();

  useEffect(() => {
    applyTheme(theme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("apgms:theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    applyTheme(theme);
  }, []);

  const pageTitle = useMemo(() => {
    const current = NAV_ITEMS.find((item) => item.to === location.pathname);
    return current?.label ?? "APGMS";
  }, [location.pathname]);

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff",
        color: theme === "dark" ? "#e2e8f0" : "#1e293b",
      }}
    >
      <a
        href="#main-content"
        style={{
          position: "absolute",
          left: "-1000px",
          top: "auto",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          zIndex: 100,
          background: "#0ea5e9",
          color: "#fff",
          padding: "0.5rem 1rem",
          borderRadius: "0.25rem",
        }}
        onFocus={(event) => {
          event.currentTarget.style.left = "1rem";
          event.currentTarget.style.width = "auto";
          event.currentTarget.style.height = "auto";
        }}
        onBlur={(event) => {
          event.currentTarget.style.left = "-1000px";
          event.currentTarget.style.width = "1px";
          event.currentTarget.style.height = "1px";
        }}
      >
        Skip to content
      </a>
      <aside
        aria-label="Primary"
        style={{
          width: "16rem",
          padding: "1.5rem 1rem",
          backgroundColor: theme === "dark" ? "#111827" : "#f1f5f9",
          borderRight: `1px solid ${theme === "dark" ? "#1f2937" : "#e2e8f0"}`,
          display: "flex",
          flexDirection: "column",
          gap: "1.5rem",
        }}
      >
        <div>
          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              fontWeight: 700,
              fontSize: "1.125rem",
              color: theme === "dark" ? "#f8fafc" : "#0f172a",
              textDecoration: "none",
            }}
          >
            APGMS
          </Link>
        </div>
        <nav aria-label="Main">
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: "0.25rem" }}>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === "/"}
                  style={({ isActive }) => ({
                    display: "block",
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    textDecoration: "none",
                    fontWeight: isActive ? 600 : 500,
                    backgroundColor: isActive
                      ? theme === "dark"
                        ? "#1e293b"
                        : "#e0f2fe"
                      : "transparent",
                    color: theme === "dark" ? "#e2e8f0" : "#0f172a",
                  })}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "1rem 1.5rem",
            borderBottom: `1px solid ${theme === "dark" ? "#1f2937" : "#e2e8f0"}`,
            backgroundColor: theme === "dark" ? "#0f172a" : "#ffffff",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div>
            <h1 style={{ fontSize: "1.5rem", margin: 0 }}>{pageTitle}</h1>
          </div>
          <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
              style={{
                borderRadius: "9999px",
                border: `1px solid ${theme === "dark" ? "#1f2937" : "#cbd5f5"}`,
                background: theme === "dark" ? "#1e293b" : "#f8fafc",
                color: theme === "dark" ? "#f8fafc" : "#0f172a",
                padding: "0.25rem 0.75rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
            <div
              aria-hidden="true"
              style={{
                width: "2.5rem",
                height: "2.5rem",
                borderRadius: "9999px",
                background: theme === "dark" ? "#1f2937" : "#e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
              }}
            >
              AJ
            </div>
          </div>
        </header>
        <main id="main-content" style={{ padding: "1.5rem", flex: 1 }}>
          {children ?? <Outlet />}
        </main>
      </div>
    </div>
  );
}

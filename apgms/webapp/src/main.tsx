import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AdminSbrPage from "./routes/admin/sbr";

const container = document.getElementById("root");

if (container) {
  const root = createRoot(container);
  const pathname = window.location.pathname;

  if (pathname === "/admin/sbr") {
    root.render(
      <StrictMode>
        <AdminSbrPage />
      </StrictMode>,
    );
  } else {
    root.render(
      <StrictMode>
        <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
          <h1>APGMS web application</h1>
          <p>Navigate to /admin/sbr to manage Secure Business Reporting settings.</p>
        </main>
      </StrictMode>,
    );
  }
}

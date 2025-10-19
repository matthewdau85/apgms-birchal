import React from "react";
import { createRoot } from "react-dom/client";
import { ObligationsPage } from "./routes/obligations";

const container = document.getElementById("root");

if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <ObligationsPage />
    </React.StrictMode>,
  );
}


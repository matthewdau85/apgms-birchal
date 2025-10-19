import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000",
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  if (!config.headers) {
    config.headers = {};
  }
  if (typeof window !== "undefined") {
    const orgId = window.sessionStorage.getItem("apgms.orgId") ?? "demo-org";
    config.headers["x-org-id"] = orgId;
  }
  return config;
});

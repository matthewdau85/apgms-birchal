import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          500: "#005F73",
          600: "#0A9396",
          700: "#94D2BD"
        }
      }
    }
  },
  plugins: []
};

export default config;

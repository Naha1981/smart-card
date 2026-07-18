import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "var(--sc-bg)",
        surface: "var(--sc-surface)",
        border: "var(--sc-border)",
        accent: "var(--sc-accent)",
        "accent-dim": "var(--sc-accent-dim)",
        text: "var(--sc-text)",
        "text-dim": "var(--sc-text-dim)",
      },
    },
  },
  plugins: [],
} satisfies Config;

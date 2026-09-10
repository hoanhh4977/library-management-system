import type { Config } from "tailwindcss";

// Tailwind v4 is CSS-first (see src/index.css `@theme`); this file only pins
// the content globs so class usage inside src/ is never purged unexpectedly.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
} satisfies Config;

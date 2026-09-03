import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#f6f8fc",
        surface: "#ffffff",
        surfaceCard: "#ffffff",
        surfaceBorder: "#e7ebf2", // --line
        brand: {
          500: "#2864f0", // --blue
          600: "#1a4dc3", // hover state
        },
        navy: "#17243b",
        muted: "#7b879d",
        coral: "#ef806d",
        riskCritical: "#ef4444",
        riskHigh: "#f97316",
        riskMedium: "#eab308",
        riskLow: "#0e9f72", // --green
      },
      fontFamily: {
        sans: ['"Trebuchet MS"', '"Segoe UI"', 'sans-serif'],
        serif: ['Georgia', 'serif'],
      },
      boxShadow: {
        'card': '0 12px 35px rgba(28,47,84,.06)',
      }
    },
  },
  plugins: [],
};
export default config;

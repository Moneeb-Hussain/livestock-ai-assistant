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
        brand: {
          DEFAULT: "#166534",
          foreground: "#ffffff",
          muted: "#dcfce7",
          surface: "#f7faf7",
        },
        urgent: {
          DEFAULT: "#ca8a04",
          foreground: "#422006",
          soft: "#fef9c3",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(0 0 0 / 0.05), 0 0 0 1px rgb(0 0 0 / 0.04)",
      },
      keyframes: {
        "chat-dot": {
          "0%, 100%": { opacity: "0.2", transform: "translateY(0)" },
          "40%": { opacity: "1", transform: "translateY(-3px)" },
        },
      },
      animation: {
        "chat-dot": "chat-dot 1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;

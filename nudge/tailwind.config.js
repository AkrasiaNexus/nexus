/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        nudge: {
          bg: "#0A0A0B",
          surface: "#141416",
          border: "#2A2A2E",
          text: "#E4E4E7",
          muted: "#71717A",
          accent: "#8B5CF6",
          accentHover: "#7C3AED",
          green: "#22C55E",
          orange: "#F59E0B",
          red: "#EF4444",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
    },
  },
  plugins: [],
};

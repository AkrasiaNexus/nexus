/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        donna: {
          bg: "#08080A",
          surface: "#121214",
          raised: "#1A1A1D",
          border: "#26262A",
          text: "#E8E8EC",
          muted: "#86868F",
          faint: "#55555E",
          accent: "#E8E8EC",
          accentHover: "#FFFFFF",
          green: "#9A9AA3",
          orange: "#9A9AA3",
          red: "#D9544D",
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

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
        // Colour earns its place on calendar blocks only: it says what kind of thing
        // a session is at a glance. The rest of the app stays black and grey.
        cat: {
          skill: "#5B8DEF",
          idea: "#A878E8",
          task: "#D9A441",
          habit: "#3FB97E",
          explore: "#D96BA0",
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

import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Opal-refined palette: charcoal surfaces, forest accents, muted lime for actions.
        ink: "#0b0d0c",
        panel: "#121514",
        card: "#171a19",
        line: "#232826",
        forest: "#1e3a28",
        leaf: "#a2d47e",
        gold: "#e9b44c",
        leafDark: "#5f9e4f",
        mute: "#8e9792",
      },
      fontFamily: { sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;

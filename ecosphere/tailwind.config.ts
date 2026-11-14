import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#050806",
        panel: "#0b120d",
        card: "#111a14",
        line: "#1f2b23",
        leaf: "#86d67e",
        gold: "#f5b83d",
        leafDark: "#4caf50",
        mute: "#8aa391",
      },
      fontFamily: { sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;

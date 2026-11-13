import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#040b06",
        panel: "#0b1a0f",
        card: "#102116",
        line: "#1d3523",
        leaf: "#8fdc7f",
        leafDark: "#4caf50",
        mute: "#8aa391",
      },
      fontFamily: { sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"] },
    },
  },
  plugins: [],
};
export default config;

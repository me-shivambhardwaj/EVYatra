import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0D2A22",
        brand: { DEFAULT: "#0F8A66", dark: "#0B6B50", soft: "#E3F4EC", mint: "#A8DCC6" },
        mist: "#F6FBF9",
        muted: "#5B7A70",
        line: "#E1EDE8",
      },
      fontFamily: { sans: ["'Plus Jakarta Sans'", "system-ui", "sans-serif"] },
      boxShadow: { card: "0 24px 60px -24px rgba(13,42,34,0.28)", soft: "0 10px 30px -14px rgba(13,42,34,0.18)" },
    },
  },
  plugins: [],
};
export default config;

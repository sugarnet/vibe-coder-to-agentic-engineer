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
        "accent-yellow": "#ecad0a",
        "primary-blue": "#209dd7",
        "secondary-purple": "#753991",
        "navy-dark": "#032147",
        "gray-text": "#888888",
        surface: "#f7f8fb",
        "surface-strong": "#ffffff",
      },
    },
  },
  plugins: [],
};

export default config;

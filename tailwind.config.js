/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#ff6700",
          orangeHover: "#e65c00",
          blue: "#023caf",
          blueDark: "#01297a",
          slateBg: "#f8fafc",
        },
        primary: {
          DEFAULT: "#ff6700",
          50: "#fff7ed",
          100: "#ffedd5",
          200: "#fed7aa",
          500: "#ff6700",
          600: "#ea580c",
          700: "#c2410c",
        },
        secondary: {
          DEFAULT: "#023caf",
          50: "#eff6ff",
          100: "#dbeafe",
          600: "#023caf",
          700: "#01297a",
        },
      },
      fontFamily: {
        sans: ["var(--font-jakarta)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

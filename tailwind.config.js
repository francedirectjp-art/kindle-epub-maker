/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        serif: ['"Hiragino Mincho ProN"', '"Yu Mincho"', "serif"],
      },
    },
  },
  plugins: [],
};

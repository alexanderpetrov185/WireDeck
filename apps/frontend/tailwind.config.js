/** @type {import('tailwindcss').Config} */
// Sprint 23: Tailwind v3 config — был отсутствует, из-за чего utilities
// не эмитировались и весь UI был нестилизован (link'и слиплись, SVG огромный).
// content сканирует все source-файлы фронтенда.
export default {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
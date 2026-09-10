// Sprint 23: PostCSS-конфиг — подключает Tailwind в сборку Next.
// Без этого файла Tailwind-плагин не запускался и utilities не генерились.
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
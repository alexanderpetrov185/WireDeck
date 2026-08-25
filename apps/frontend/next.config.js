/** @type {import('next').NextConfig} */
// Конфигурация Next.js приложения
const nextConfig = {
  // Включение standalone режима для Docker
  // Это создает минимальную сборку для production
  output: 'standalone',
};

// Экспорт конфигурации в формате ES module
export default nextConfig;

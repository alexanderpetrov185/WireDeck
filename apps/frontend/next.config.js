/** @type {import('next').NextConfig} */
// Конфигурация Next.js приложения
const nextConfig = {
  // Экспериментальные возможности
  experimental: {
    // Включение нового App Router (app директории)
    appDir: true,
  },
  // Переменные окружения, которые будут доступны в браузере
  env: {
    // URL бэкенд API для взаимодействия с сервером
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  },
};

// Экспорт конфигурации
module.exports = nextConfig;
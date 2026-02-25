// Sentry bundle configuration for Next.js
// Конфигурация Sentry для сборки Next.js

module.exports = {
  // Организационные настройки
  org: process.env.SENTRY_ORG || 'crypto-news-bot',
  project: process.env.SENTRY_PROJECT || 'frontend',
  
  // Auth token для загрузки sourcemaps
  authToken: process.env.SENTRY_AUTH_TOKEN,
  
  // Отключение загрузки sourcemaps в development
  disableClient: process.env.NODE_ENV === 'development',
  
  // Настройки sourcemaps
  sourcemaps: {
    assets: ['./.next/static/**/*'],
    ignore: ['node_modules'],
  },
  
  // Отключение telemetry
  telemetry: false,
  
  // Конфигурация webpack
  webpack: (config, options) => {
    // Добавление Sentry плагина только для production
    if (options.isServer && process.env.NODE_ENV === 'production') {
      const { sentryWebpackPlugin } = require('@sentry/webpack-plugin');
      config.plugins.push(
        sentryWebpackPlugin({
          org: process.env.SENTRY_ORG,
          project: process.env.SENTRY_PROJECT,
          authToken: process.env.SENTRY_AUTH_TOKEN,
        })
      );
    }
    return config;
  },
};

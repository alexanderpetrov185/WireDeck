// ESLint конфигурация для Next.js frontend приложения
// Формат для ESLint v9+ (Flat Config)

import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import nextPlugin from '@next/eslint-plugin-next';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@next/next/no-html-link-for-pages': 'off',
    },
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Игнорировать конфигурационные файлы и служебные директории
    ignores: ['node_modules', '.next', 'out', 'build', '*.config.js', '*.config.mjs', '*.config.cjs'],
  },
  {
    // Разрешить process и module для .config.js файлов
    files: ['**/*.config.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        module: 'readonly',
      },
    },
  }
);

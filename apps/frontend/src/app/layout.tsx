// Импорт глобальных стилей
import './globals.css'
// Импорт типов для метаданных страницы
import type { Metadata } from 'next'
// Импорт Google шрифта Inter
import { Inter } from 'next/font/google'
// Импорт инициализации Sentry для клиента
import { initSentryClient } from '../lib/sentry/sentry.client'
// Импорт навигации
import TopNav from '../components/TopNav'

// Инициализация Sentry на клиенте
if (typeof window !== 'undefined') {
  initSentryClient();
}

// Настройка шрифта Inter с подмножеством латинских символов
const inter = Inter({ subsets: ['latin'] })

// Метаданные страницы для SEO
export const metadata: Metadata = {
  title: 'WireDeck Admin Panel', // Заголовок страницы
  description: 'Admin panel for managing financial and market news', // Описание страницы
}

// Компонент корневого макета приложения
export default function RootLayout({
  children, // Дочерние компоненты, которые будут отображаться внутри макета
}: {
  children: React.ReactNode // Тип для дочерних элементов
}) {
  return (
    // HTML корень с языком английский
    <html lang="en">
      {/* Тело страницы с примененным шрифтом */}
      <body className={`${inter.className} min-h-screen bg-gray-50`}>
        {/* Навигация */}
        <TopNav />
        {/* Отображение дочерних компонентов */}
        <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          {children}
        </main>
      </body>
    </html>
  )
}
// Импорт глобальных стилей
import './globals.css'
// Импорт типов для метаданных страницы
import type { Metadata } from 'next'
// Импорт Google шрифта Inter
import { Inter } from 'next/font/google'

// Настройка шрифта Inter с подмножеством латинских символов
const inter = Inter({ subsets: ['latin'] })

// Метаданные страницы для SEO
export const metadata: Metadata = {
  title: 'Crypto News Admin Panel', // Заголовок страницы
  description: 'Admin panel for managing crypto news Telegram bot', // Описание страницы
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
      <body className={inter.className}>
        {/* Отображение дочерних компонентов */}
        {children}
      </body>
    </html>
  )
}
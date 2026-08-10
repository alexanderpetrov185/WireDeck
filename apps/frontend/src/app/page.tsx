// Указывает, что этот компонент должен выполняться на клиенте
'use client'

// Импорт хуков React для управления состоянием и эффектами
import { useState, useEffect } from 'react'

// Главный компонент домашней страницы админ-панели
export default function Home() {
  // Состояние для хранения количества новостей
  const [newsCount, setNewsCount] = useState(0);
  // Состояние для хранения статуса бота
  const [botStatus, setBotStatus] = useState('offline');

  // Эффект для инициализации данных при монтировании компонента
  useEffect(() => {
    // Симуляция получения данных с бэкенда
    setNewsCount(42);
    setBotStatus('online');
  }, []); // Пустой массив зависимостей означает, что эффект выполнится только один раз при монтировании

  return (
    // Основной контейнер страницы
    <div className="min-h-screen bg-gray-50">
      {/* Шапка страницы */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold text-gray-900">WireDeck Admin Panel</h1>
        </div>
      </header>
      {/* Основное содержимое страницы */}
      <main>
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            {/* Сетка карточек статистики */}
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Карточка общего количества новостей */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Total News Articles</dt>
                        <dd className="flex items-baseline">
                          {/* Отображение количества новостей из состояния */}
                          <div className="text-2xl font-semibold text-gray-900">{newsCount}</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Карточка статуса бота */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Bot Status</dt>
                        <dd className="flex items-baseline">
                          {/* Отображение статуса бота с цветовой индикацией */}
                          <div className={`text-2xl font-semibold ${botStatus === 'online' ? 'text-green-600' : 'text-red-600'}`}>
                            {botStatus.toUpperCase()}
                          </div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>

              {/* Карточка подписчиков */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">Subscribers</dt>
                        <dd className="flex items-baseline">
                          <div className="text-2xl font-semibold text-gray-900">1,248</div>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Таблица последних новостей */}
            <div className="mt-8 bg-white overflow-hidden shadow rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-xl font-semibold text-gray-800 mb-4">Recent News Articles</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap">Federal Reserve Holds Interest Rates Steady</td>
                        <td className="px-6 py-4 whitespace-nowrap">Reuters</td>
                        <td className="px-6 py-4 whitespace-nowrap">2023-06-15</td>
                        <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Published</span></td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap">S&P 500 Closes at Record High</td>
                        <td className="px-6 py-4 whitespace-nowrap">Bloomberg</td>
                        <td className="px-6 py-4 whitespace-nowrap">2023-06-14</td>
                        <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">Published</span></td>
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap">EUR/USD Rallies After ECB Statement</td>
                        <td className="px-6 py-4 whitespace-nowrap">Bloomberg</td>
                        <td className="px-6 py-4 whitespace-nowrap">2023-06-13</td>
                        <td className="px-6 py-4 whitespace-nowrap"><span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Pending</span></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
# WireDeck — Module Boundaries

Документ фиксирует разрешённые и запрещённые зависимости между модулями.

## Общие правила

- Модули общаются ТОЛЬКО через интерфейсы и DI-токены.
- Прямой импорт сущности/репозитория из соседнего модуля ЗАПРЕЩЁн.
- Каждый модуль экспортирует только то, что необходимо другим модулям.

## Матрица зависимостей

| Модуль (источник) | Может импортировать | Запрещено импортировать |
|-------------------|---------------------|------------------------|
| Collector | ConfigModule, HttpModule, LoggerService | NewsModule, NewsService, TypeORM |
| Ingestion | CollectorModule, NewsModule | внутренности Collector |
| News (Domain) | TypeORM, CommonModule | Collector, AI Processing, Translation |
| AI Processing | NewsModule, AiProviderModule, ConfigModule, LoggerService | CollectorModule |
| Translation | NewsModule, TranslationProviderModule, ConfigModule, LoggerService | CollectorModule |
| Moderation (Sprint 7) | NewsModule, LoggerService | Collector, AI Processing, Translation |
| Publishing (Sprint 8) | NewsModule, LoggerService | Collector, AI Processing, Translation |
| Frontend | публичные HTTP-эндпоинты | исходники backend |

## Детали

### Collector -> запрещено импортировать NewsService
CollectorModule не импортирует NewsModule. Коллекторы возвращают чистый DTO CollectedNews[] и не знают о БД.

### AI Processing -> запрещено импортировать Collector
AiProcessingModule работает только с NewsService и AI_PROVIDER. Коллекторы не используются напрямую.

### Translation -> запрещено импортировать Collector
TranslationModule работает только с NewsService и TRANSLATION_PROVIDER. Коллекторы не используются напрямую.

### Frontend -> запрещено импортировать backend
Frontend (Next.js) общается с backend (NestJS) ТОЛЬКО по HTTP. Исходники backend не импортируются в frontend-пакет.

## DI-токены

| Токен | Интерфейс/класс | Модуль |
|-------|-----------------|--------|
| AI_PROVIDER | AiProvider | AiProviderModule |
| TRANSLATION_PROVIDER | TranslationProvider | TranslationProviderModule |
| NEWS_COLLECTORS | NewsCollector[] | CollectorModule |
| INGESTION_TOKEN | string (guard) | IngestionModule |

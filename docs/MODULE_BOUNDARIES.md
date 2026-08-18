# WireDeck — Module Boundaries

Документ фиксирует разрешённые и запрещённые зависимости между модулями.

## Общие правила

- Модули общаются ТОЛЬКО через интерфейсы и DI-токены.
- Прямой импорт сущности/репозитория из соседнего модуля ЗАПРЕЩЁн.
- Каждый модуль экспортирует только то, что необходимо другим модулям.
- Enums (`NewsSource`, `NewsLanguage`) вынесены в `news/constants/` и могут
  импортироваться любым модулем без нарушения границ.

## Матрица зависимостей

| Модуль (источник) | Может импортировать | Запрещено импортировать |
|-------------------|---------------------|------------------------|
| Collector | ConfigModule, HttpModule, LoggerService, NewsSource/NewsLanguage enums (из constants) | NewsModule, NewsService, TypeORM, News entity |
| Ingestion | CollectorModule, NewsModule | внутренности Collector |
| News (Domain) | TypeORM, CommonModule | Collector, AI Processing, Translation |
| AI Processing | NewsModule, AiProviderModule, ConfigModule, LoggerService | CollectorModule |
| Translation | NewsModule, TranslationProviderModule, ConfigModule, LoggerService | CollectorModule |
| Moderation (Sprint 7) | NewsModule, LoggerService | Collector, AI Processing, Translation |
| Publishing (Sprint 8) | NewsModule, LoggerService | Collector, AI Processing, Translation |
| Frontend | публичные HTTP-эндпоинты | исходники backend |

## Детали

### Collector -> запрещено импортировать NewsService и TypeORM
CollectorModule не импортирует NewsModule. Коллекторы возвращают чистый DTO CollectedNews[] и не знают о БД.
Enums `NewsSource` и `NewsLanguage` импортируются из `news/constants/` (не из entity).

### Enum extraction
`NewsSource` и `NewsLanguage` вынесены из `news.entity.ts` в отдельные файлы:
- `apps/backend/src/modules/news/constants/news-source.enum.ts`
- `apps/backend/src/modules/news/constants/news-language.enum.ts`

Это позволяет Collector и другим модулям использовать эти enums без импорта TypeORM-сущностей.

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
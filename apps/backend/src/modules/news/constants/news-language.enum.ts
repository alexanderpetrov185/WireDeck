// Язык контента (источники EN/RU → целевой EN)
// Вынесен из news.entity.ts, чтобы Collector и другие модули
// не импортировали TypeORM-сущности (архитектурная граница).
export enum NewsLanguage {
  EN = 'en',
  RU = 'ru',
  UZ = 'uz',
}
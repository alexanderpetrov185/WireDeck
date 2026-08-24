// Модуль доменной модели новостей
// Отвечает за хранение и базовые операции с новостями (Sprint 1)

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { News } from './entities/news.entity';
import { NewsService } from './news.service';
import { NewsController } from './news.controller';

@Module({
  imports: [
    // Регистрация сущности News для использования репозитория
    // autoLoadEntities: true в AppModule подхватит её автоматически
    TypeOrmModule.forFeature([News]),
  ],
  controllers: [NewsController],
  providers: [NewsService],
  // Экспорт сервиса и модуля репозиториев для использования другими модулями
  exports: [NewsService, TypeOrmModule],
})
// Модуль доменной модели новостей
export class NewsModule {}

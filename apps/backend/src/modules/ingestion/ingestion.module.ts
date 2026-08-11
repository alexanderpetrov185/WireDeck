import { Module } from '@nestjs/common';
import { IngestionService } from './ingestion.service';
import { IngestionController } from './ingestion.controller';
import { IngestionGuard } from './ingestion.guard';
import { CollectorModule } from '../collector/collector.module';
import { NewsModule } from '../news/news.module';

@Module({
  imports: [
    CollectorModule, // Импортируем модуль сбора, чтобы получить доступ к CollectorService
    NewsModule,      // Импортируем модуль новостей, чтобы получить доступ к NewsService
  ],
  controllers: [IngestionController],
  providers: [IngestionService, IngestionGuard],
  exports: [IngestionService],
})
export class IngestionModule {}

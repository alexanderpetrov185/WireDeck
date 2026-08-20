import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PublishingService } from './publishing.service';
import { PublishingController } from './publishing.controller';
import { TelegramPublisherProvider } from './providers/telegram-publisher.provider';
import { PUBLISHER_TOKEN } from './providers/publisher.token';
import { NewsModule } from '../news/news.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 15000,
    }),
    NewsModule, // Для доступа к NewsService
  ],
  controllers: [PublishingController],
  providers: [
    PublishingService,
    {
      provide: PUBLISHER_TOKEN,
      useClass: TelegramPublisherProvider,
    },
  ],
  exports: [PublishingService],
})
export class PublishingModule {}

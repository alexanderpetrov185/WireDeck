import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PublishingService } from './publishing.service';
import { PublishingController } from './publishing.controller';
import { PublishingStuckSweeperService } from './publishing-stuck-sweeper.service';
import { TelegramPublisherProvider } from './providers/telegram-publisher.provider';
import { PUBLISHER_TOKEN } from './providers/publisher.token';
import { NewsModule } from '../news/news.module';
import { ComplianceModule } from '../compliance/compliance.module';

@Module({
  imports: [
    HttpModule.register({
      timeout: 15000,
    }),
    NewsModule, // Для доступа к NewsService
    ComplianceModule, // Sprint 19: compliance scan перед публикацией
  ],
  controllers: [PublishingController],
  providers: [
    PublishingService,
    PublishingStuckSweeperService,
    {
      provide: PUBLISHER_TOKEN,
      useClass: TelegramPublisherProvider,
    },
  ],
  exports: [PublishingService, PublishingStuckSweeperService],
})
export class PublishingModule {}


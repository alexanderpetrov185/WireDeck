import { Module } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { ModerationController } from './moderation.controller';
import { NewsModule } from '../news/news.module';

@Module({
  imports: [
    NewsModule, // Для доступа к NewsService
  ],
  controllers: [ModerationController],
  providers: [ModerationService],
  exports: [ModerationService],
})
export class ModerationModule {}
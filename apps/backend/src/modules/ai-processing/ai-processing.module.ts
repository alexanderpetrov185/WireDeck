import { Module } from '@nestjs/common';
import { AiProcessingService } from './ai-processing.service';
import { AiProcessingController } from './ai-processing.controller';
import { ConfigModule } from '@nestjs/config';
import { AiProviderModule } from './providers/ai-provider.module';
import { NewsModule } from '../news/news.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AiProviderModule,
    NewsModule,
  ],
  controllers: [AiProcessingController],
  providers: [AiProcessingService],
  exports: [AiProcessingService],
})
export class AiProcessingModule {}

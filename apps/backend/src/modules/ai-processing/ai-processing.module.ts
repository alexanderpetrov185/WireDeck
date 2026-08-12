import { Module } from '@nestjs/common';
import { AiProcessingService } from './ai-processing.service';
import { AiProcessingController } from './ai-processing.controller';
import { AiProvider } from './ai-provider.interface';
import { AiResult } from './ai-result.interface';
import { ConfigModule } from '@nestjs/config';
import { AiProviderModule } from './providers/ai-provider.module';
import { TokenGuard } from '../../../common/guards/token.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AiProviderModule,
  ],
  controllers: [AiProcessingController],
  providers: [AiProcessingService],
  exports: [AiProcessingService],
})
export class AiProcessingModule {}
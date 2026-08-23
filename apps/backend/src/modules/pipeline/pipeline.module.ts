import { Module } from '@nestjs/common';
import { PipelineService } from './pipeline.service';
import { PipelineProcessor } from './pipeline.processor';
import { PipelineController } from './pipeline.controller';
import { PipelineLifecycle } from './pipeline.lifecycle';
import { SchedulerService } from './scheduler.service';
import { pipelineQueueProvider, pipelineWorkerProvider } from './pipeline.queue';
import { IngestionModule } from '../ingestion/ingestion.module';
import { AiProcessingModule } from '../ai-processing/ai-processing.module';
import { TranslationModule } from '../translation/translation.module';
import { ModerationModule } from '../moderation/moderation.module';
import { PublishingModule } from '../publishing/publishing.module';

@Module({
  imports: [
    IngestionModule,
    AiProcessingModule,
    TranslationModule,
    ModerationModule,
    PublishingModule,
  ],
  controllers: [PipelineController],
  providers: [
    PipelineService,
    PipelineProcessor,
    PipelineLifecycle,
    SchedulerService,
    pipelineQueueProvider,
    pipelineWorkerProvider,
  ],
  exports: [PipelineService, SchedulerService],
})
export class PipelineModule {}
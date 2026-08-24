// Модуль проверки состояния приложения
import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from './health.controller';
// PipelineModule даёт доступ к существующему BullMQ Queue (PIPELINE_QUEUE)
// — Redis проверяется через него без второго клиента.
import { PipelineModule } from '../modules/pipeline/pipeline.module';

@Module({
  imports: [TerminusModule, PipelineModule],
  controllers: [HealthController],
  providers: [],
})
export class HealthModule {}

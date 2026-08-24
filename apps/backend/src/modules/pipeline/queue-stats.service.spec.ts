import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { QueueStatsService } from './queue-stats.service';
import { LoggerService } from '../../common/logger/logger.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { PIPELINE_QUEUE } from './pipeline.queue';

describe('QueueStatsService', () => {
  let service: QueueStatsService;
  let queue: { getJobCounts: jest.Mock };
  let metrics: { setQueueJobCounts: jest.Mock };

  const createModule = async (env: Record<string, string> = {}) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueStatsService,
        {
          provide: PIPELINE_QUEUE,
          useValue: {
            getJobCounts: jest.fn().mockResolvedValue({
              waiting: 1,
              active: 0,
              completed: 3,
              failed: 2,
              delayed: 0,
            }),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, def: unknown) => env[key] ?? def) },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
        },
        { provide: MetricsService, useValue: { setQueueJobCounts: jest.fn() } },
      ],
    }).compile();

    return {
      module,
      service: module.get<QueueStatsService>(QueueStatsService),
      queue: module.get<Queue>(PIPELINE_QUEUE) as unknown as { getJobCounts: jest.Mock },
      metrics: module.get<MetricsService>(MetricsService) as unknown as { setQueueJobCounts: jest.Mock },
    };
  };

  beforeEach(async () => {
    const created = await createModule();
    service = created.service;
    queue = created.queue;
    metrics = created.metrics;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should collect real job counts into gauges', async () => {
    await service.collect();

    expect(queue.getJobCounts).toHaveBeenCalled();
    expect(metrics.setQueueJobCounts).toHaveBeenCalledWith('wiredeck-pipeline', {
      waiting: 1,
      active: 0,
      completed: 3,
      failed: 2,
      delayed: 0,
    });
  });

  it('should not throw when collection fails', async () => {
    (queue.getJobCounts as jest.Mock).mockRejectedValue(new Error('redis down'));

    await expect(service.collect()).rejects.toThrow('redis down');
    // onModuleInit оборачивает collect в catch — не должен ронять приложение
    expect(() => service.onModuleInit()).not.toThrow();
    service.onModuleDestroy();
  });

  it('should start and stop cleanly via lifecycle hooks', () => {
    service.onModuleInit();
    expect(() => service.onModuleDestroy()).not.toThrow();
  });
});

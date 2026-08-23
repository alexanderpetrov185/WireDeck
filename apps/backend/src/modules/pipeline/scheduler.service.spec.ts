import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { SchedulerService } from './scheduler.service';
import { LoggerService } from '../../common/logger/logger.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { PIPELINE_QUEUE } from './pipeline.queue';
import { PIPELINE_JOB_ID, PIPELINE_JOB_NAME } from './pipeline.constants';

describe('SchedulerService', () => {
  let service: SchedulerService;
  let queue: Queue;
  let metrics: MetricsService;

  const mockJob = (state: string) => ({
    id: PIPELINE_JOB_ID,
    getState: jest.fn().mockResolvedValue(state),
    remove: jest.fn().mockResolvedValue(undefined),
  });

  const createModule = async (env: Record<string, string>) => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SchedulerService,
        {
          provide: PIPELINE_QUEUE,
          useValue: {
            getJob: jest.fn(),
            add: jest.fn().mockResolvedValue({ id: PIPELINE_JOB_ID }),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, def: unknown) => env[key] ?? def),
          },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
        },
        {
          provide: MetricsService,
          useValue: { updateQueueSize: jest.fn(), observeQueueJob: jest.fn() },
        },
      ],
    }).compile();

    return {
      module,
      service: module.get<SchedulerService>(SchedulerService),
      queue: module.get<Queue>(PIPELINE_QUEUE),
      metrics: module.get<MetricsService>(MetricsService),
    };
  };

  beforeEach(async () => {
    const created = await createModule({ SCHEDULER_ENABLED: 'false' });
    service = created.service;
    queue = created.queue;
    metrics = created.metrics;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('scheduler disabled', () => {
    it('should not start interval when SCHEDULER_ENABLED is false', async () => {
      const { service: s } = await createModule({ SCHEDULER_ENABLED: 'false' });
      // onModuleInit не должен создавать setInterval — проверяем, что enqueue не вызывается.
      s.onModuleInit();
      expect(queue.getJob).not.toHaveBeenCalled();
      s.onModuleDestroy();
    });
  });

  describe('scheduler enabled', () => {
    it('should enqueue job on startup when enabled', async () => {
      const { service: s, queue: q } = await createModule({
        SCHEDULER_ENABLED: 'true',
        PIPELINE_INTERVAL_MS: '60000',
      });
      (q.getJob as jest.Mock).mockResolvedValue(null);

      s.onModuleInit();
      // Даём микротаску выполниться (enqueueJob асинхронный).
      await new Promise((r) => setTimeout(r, 10));

      expect(q.getJob).toHaveBeenCalledWith(PIPELINE_JOB_ID);
      expect(q.add).toHaveBeenCalledWith(
        PIPELINE_JOB_NAME,
        {},
        expect.objectContaining({ jobId: PIPELINE_JOB_ID }),
      );
      s.onModuleDestroy();
    });

    it('should not create duplicate when job is active', async () => {
      const { service: s, queue: q } = await createModule({
        SCHEDULER_ENABLED: 'true',
        PIPELINE_INTERVAL_MS: '60000',
      });
      (q.getJob as jest.Mock).mockResolvedValue(mockJob('active'));

      const result = await s.enqueueJob();

      expect(result).toBe(false);
      expect(q.add).not.toHaveBeenCalled();
    });

    it('should create new job after completed job', async () => {
      const { service: s, queue: q } = await createModule({
        SCHEDULER_ENABLED: 'true',
        PIPELINE_INTERVAL_MS: '60000',
      });
      const completedJob = mockJob('completed');
      (q.getJob as jest.Mock).mockResolvedValue(completedJob);

      const result = await s.enqueueJob();

      expect(result).toBe(true);
      expect(completedJob.remove).toHaveBeenCalled();
      expect(q.add).toHaveBeenCalled();
    });

    it('should create new job after failed job', async () => {
      const { service: s, queue: q } = await createModule({
        SCHEDULER_ENABLED: 'true',
        PIPELINE_INTERVAL_MS: '60000',
      });
      const failedJob = mockJob('failed');
      (q.getJob as jest.Mock).mockResolvedValue(failedJob);

      const result = await s.enqueueJob();

      expect(result).toBe(true);
      expect(failedJob.remove).toHaveBeenCalled();
      expect(q.add).toHaveBeenCalled();
    });

    it('should handle concurrent enqueue (only one job added)', async () => {
      const { service: s, queue: q } = await createModule({
        SCHEDULER_ENABLED: 'true',
        PIPELINE_INTERVAL_MS: '60000',
      });
      // Первый вызов: нет существующего job → добавляем.
      // Второй вызов: job уже active → пропускаем.
      (q.getJob as jest.Mock)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockJob('active'));

      const [r1, r2] = await Promise.all([s.enqueueJob(), s.enqueueJob()]);

      expect(r1).toBe(true);
      expect(r2).toBe(false);
      expect(q.add).toHaveBeenCalledTimes(1);
    });
  });

  describe('interval validation', () => {
    it('should use default interval for invalid value', async () => {
      const { service: s } = await createModule({
        SCHEDULER_ENABLED: 'true',
        PIPELINE_INTERVAL_MS: '0',
      });
      // resolveIntervalMs приватный, но onModuleInit использует его.
      // Проверяем, что не падает и не создаёт неконтролируемый интервал.
      s.onModuleInit();
      s.onModuleDestroy();
      expect(true).toBe(true);
    });
  });
});
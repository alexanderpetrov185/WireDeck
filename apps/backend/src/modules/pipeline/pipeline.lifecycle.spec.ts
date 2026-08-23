import { Test, TestingModule } from '@nestjs/testing';
import { Queue, Worker } from 'bullmq';
import { PipelineLifecycle } from './pipeline.lifecycle';
import { SchedulerService } from './scheduler.service';
import { LoggerService } from '../../common/logger/logger.service';
import { PIPELINE_QUEUE, PIPELINE_WORKER } from './pipeline.queue';

describe('PipelineLifecycle', () => {
  let lifecycle: PipelineLifecycle;
  let scheduler: SchedulerService;
  let worker: Worker;
  let queue: Queue;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineLifecycle,
        {
          provide: SchedulerService,
          useValue: { stop: jest.fn() },
        },
        {
          provide: PIPELINE_WORKER,
          useValue: { close: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: PIPELINE_QUEUE,
          useValue: { close: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
        },
      ],
    }).compile();

    lifecycle = module.get<PipelineLifecycle>(PipelineLifecycle);
    scheduler = module.get<SchedulerService>(SchedulerService);
    worker = module.get<Worker>(PIPELINE_WORKER);
    queue = module.get<Queue>(PIPELINE_QUEUE);
  });

  it('should be defined', () => {
    expect(lifecycle).toBeDefined();
  });

  it('should stop scheduler first, then close worker and queue', async () => {
    const order: string[] = [];
    (scheduler.stop as jest.Mock).mockImplementation(() => order.push('scheduler'));
    (worker.close as jest.Mock).mockImplementation(() => {
      order.push('worker');
      return Promise.resolve(undefined);
    });
    (queue.close as jest.Mock).mockImplementation(() => {
      order.push('queue');
      return Promise.resolve(undefined);
    });

    await lifecycle.onModuleDestroy();

    expect(order).toEqual(['scheduler', 'worker', 'queue']);
  });

  it('should continue shutdown even if worker close fails', async () => {
    (worker.close as jest.Mock).mockRejectedValue(new Error('worker close failed'));

    await expect(lifecycle.onModuleDestroy()).resolves.toBeUndefined();
    expect(queue.close).toHaveBeenCalled();
  });

  it('should continue shutdown even if queue close fails', async () => {
    (queue.close as jest.Mock).mockRejectedValue(new Error('queue close failed'));

    await expect(lifecycle.onModuleDestroy()).resolves.toBeUndefined();
  });
});
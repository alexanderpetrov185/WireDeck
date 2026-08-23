import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import { PipelineProcessor } from './pipeline.processor';
import { PipelineService, PipelineResult } from './pipeline.service';
import { LoggerService } from '../../common/logger/logger.service';

describe('PipelineProcessor', () => {
  let processor: PipelineProcessor;
  let pipelineService: PipelineService;

  const mockJob = (id: string, name: string): Job => ({
    id,
    name,
  } as unknown as Job);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineProcessor,
        {
          provide: PipelineService,
          useValue: {
            runFullPipeline: jest.fn().mockResolvedValue({
              steps: [],
              totalErrors: 0,
              completedAt: new Date(),
            } as PipelineResult),
          },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
        },
      ],
    }).compile();

    processor = module.get<PipelineProcessor>(PipelineProcessor);
    pipelineService = module.get<PipelineService>(PipelineService);
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  it('should invoke PipelineService and return result', async () => {
    const job = mockJob('scheduled-full-pipeline', 'full-pipeline');
    const result = await processor.process(job);

    expect(pipelineService.runFullPipeline).toHaveBeenCalled();
    expect(result.totalErrors).toBe(0);
  });

  it('should propagate unhandled job-level errors (for BullMQ retry)', async () => {
    (pipelineService.runFullPipeline as jest.Mock).mockRejectedValue(new Error('redis down'));
    const job = mockJob('scheduled-full-pipeline', 'full-pipeline');

    await expect(processor.process(job)).rejects.toThrow('redis down');
  });
});
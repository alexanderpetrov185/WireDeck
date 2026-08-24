import { Test, TestingModule } from '@nestjs/testing';
import { Queue } from 'bullmq';
import {
  HealthCheckService,
  HealthCheckError,
  TypeOrmHealthIndicator,
} from '@nestjs/terminus';
import { HealthController } from './health.controller';
import { PIPELINE_QUEUE } from '../modules/pipeline/pipeline.queue';

describe('HealthController', () => {
  let controller: HealthController;
  let health: { check: jest.Mock };
  let db: { pingCheck: jest.Mock };
  let queue: { client: Promise<{ ping: jest.Mock }> };

  const createModule = async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn(async (indicators: Array<() => unknown>) => {
              const result: Record<string, unknown> = {};
              for (const indicator of indicators) {
                Object.assign(result, await indicator());
              }
              return { status: 'ok', info: result };
            }),
          },
        },
        { provide: TypeOrmHealthIndicator, useValue: { pingCheck: jest.fn() } },
        {
          provide: PIPELINE_QUEUE,
          useValue: { client: Promise.resolve({ ping: jest.fn().mockResolvedValue('PONG') }) },
        },
      ],
    }).compile();

    return {
      module,
      controller: module.get<HealthController>(HealthController),
      health: module.get(HealthCheckService) as unknown as { check: jest.Mock },
      db: module.get(TypeOrmHealthIndicator) as unknown as { pingCheck: jest.Mock },
      queue: module.get<Queue>(PIPELINE_QUEUE),
    };
  };

  beforeEach(async () => {
    const created = await createModule();
    controller = created.controller;
    health = created.health;
    db = created.db;
    queue = created.queue as unknown as { client: Promise<{ ping: jest.Mock }> };
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /health (full)', () => {
    it('should check database and redis (no external pings)', async () => {
      (db.pingCheck as jest.Mock).mockResolvedValue({ database: { status: 'up' } });

      const result = await controller.check();

      expect(db.pingCheck).toHaveBeenCalledWith('database');
      expect((await (queue as unknown as { client: Promise<{ ping: jest.Mock }> }).client).ping).toHaveBeenCalled();
      expect(result).toEqual({
        status: 'ok',
        info: { database: { status: 'up' }, redis: { status: 'up' } },
      });
    });

    it('should fail when redis is down', async () => {
      (db.pingCheck as jest.Mock).mockResolvedValue({ database: { status: 'up' } });
      (queue as unknown as { client: Promise<{ ping: jest.Mock }> }).client = Promise.resolve({
        ping: jest.fn().mockRejectedValue(new Error('connection refused')),
      });
      (health.check as jest.Mock).mockImplementation(async (indicators: Array<() => unknown>) => {
        for (const indicator of indicators) {
          await indicator();
        }
        return { status: 'ok' };
      });

      await expect(controller.ready()).rejects.toThrow(HealthCheckError);
    });
  });

  describe('GET /health/live (liveness)', () => {
    it('should always report ok without checking dependencies', async () => {
      const result = await controller.live();

      expect(result).toEqual({ status: 'ok' });
      expect(db.pingCheck).not.toHaveBeenCalled();
    });
  });

  describe('GET /health/ready (readiness)', () => {
    it('should check database and redis', async () => {
      (db.pingCheck as jest.Mock).mockResolvedValue({ database: { status: 'up' } });

      await controller.ready();

      expect(db.pingCheck).toHaveBeenCalledWith('database');
      expect(queue).toBeDefined();
    });
  });
});

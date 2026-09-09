import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { SourceTiersService } from './source-tiers.service';
import { LoggerService } from '../../common/logger/logger.service';

describe('SourceTiersService (Sprint 22b)', () => {
  let tmpDir: string;

  const writeConfig = (content: object | string): string => {
    const file = path.join(tmpDir, `tiers-${Date.now()}-${Math.random()}.json`);
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
    return file;
  };

  const createService = (pathValue: string): SourceTiersService => {
    const svc = new SourceTiersService(
      { get: (key: string, d?: unknown) => (key === 'SOURCE_TIERS_PATH' ? pathValue : d) } as unknown as ConfigService,
      { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as unknown as LoggerService,
    );
    svc.onModuleInit();
    return svc;
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-tiers-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('resolves exact and case-insensitive by sourceName', () => {
    const svc = createService(writeConfig({ bySourceName: { cnbc: 1, 'yahoo finance': 2 }, default: 2 }));
    expect(svc.resolve('CNBC')).toBe(1);
    expect(svc.resolve('Yahoo Finance')).toBe(2);
  });

  it('matches substring: short key matches long feed.title', () => {
    const svc = createService(writeConfig({ bySourceName: { CNBC: 1 }, default: 2 }));
    expect(svc.resolve('CNBC: Top News & Analysis')).toBe(1);
    expect(svc.resolve('cnbc markets now')).toBe(1);
  });

  it('returns default tier for unknown source', () => {
    const svc = createService(writeConfig({ bySourceName: { CNBC: 1 }, default: 3 }));
    expect(svc.resolve('Random Blog')).toBe(3);
  });

  it('uses default 2 when config disabled (empty path)', () => {
    const svc = createService('');
    expect(svc.resolve('CNBC')).toBe(2);
    expect(svc.resolve(null)).toBe(2);
    expect(svc.resolve(undefined)).toBe(2);
  });

  it('disabled with warn on invalid JSON (fail-open, tier 2)', () => {
    const svc = createService(writeConfig('{ broken json'));
    expect(svc.resolve('CNBC')).toBe(2);
  });

  it('skips invalid tier values but keeps valid ones', () => {
    const svc = createService(writeConfig({ bySourceName: { CNBC: 9, Reuters: 1, X: 'bad' }, default: 2 }));
    expect(svc.resolve('CNBC')).toBe(2); // invalid tier → не в мапе
    expect(svc.resolve('Reuters')).toBe(1);
  });
});

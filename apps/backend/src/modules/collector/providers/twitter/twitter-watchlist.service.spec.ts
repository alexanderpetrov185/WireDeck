import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { TwitterWatchlistService } from './twitter-watchlist.service';
import { LoggerService } from '../../../../common/logger/logger.service';

describe('TwitterWatchlistService (Sprint 22c)', () => {
  let tmpDir: string;

  const writeConfig = (content: object | string): string => {
    const file = path.join(tmpDir, `wl-${Date.now()}-${Math.random()}.json`);
    fs.writeFileSync(file, typeof content === 'string' ? content : JSON.stringify(content));
    return file;
  };

  const createService = (pathValue: string): TwitterWatchlistService => {
    const svc = new TwitterWatchlistService(
      { get: (key: string, d?: unknown) => (key === 'TWITTER_WATCHLIST_PATH' ? pathValue : d) } as unknown as ConfigService,
      { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } as unknown as LoggerService,
    );
    svc.onModuleInit();
    return svc;
  };

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wd-wl-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('disabled when path empty', () => {
    const svc = createService('');
    expect(svc.isEnabled()).toBe(false);
    expect(svc.getEntries()).toEqual([]);
  });

  it('loads valid entries, strips @, parses unconfirmed flag', () => {
    const svc = createService(
      writeConfig([
        { handle: '@valid_user', tier: 1, unconfirmed: true },
        { handle: 'second', tier: 2, unconfirmed: false },
      ]),
    );
    expect(svc.isEnabled()).toBe(true);
    expect(svc.getEntries()).toEqual([
      { handle: 'valid_user', tier: 1, unconfirmed: true, note: undefined },
      { handle: 'second', tier: 2, unconfirmed: false, note: undefined },
    ]);
  });

  it('skips invalid handles and tiers', () => {
    const svc = createService(
      writeConfig([
        { handle: 'bad handle!', tier: 1 },
        { handle: 'toolonghandlethatexceeds15chars', tier: 1 },
        { handle: 'okuser', tier: 9 },
        { handle: 'gooduser', tier: 2 },
      ]),
    );
    expect(svc.isEnabled()).toBe(true);
    expect(svc.getEntries()).toHaveLength(1);
    expect(svc.getEntries()[0].handle).toBe('gooduser');
  });

  it('disabled with warn on broken JSON (fail-open)', () => {
    const svc = createService(writeConfig('{ broken'));
    expect(svc.isEnabled()).toBe(false);
    expect(svc.getEntries()).toEqual([]);
  });

  it('caps entries at 50', () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ handle: `user_${i}`, tier: 2 }));
    const svc = createService(writeConfig(many));
    expect(svc.getEntries().length).toBe(50);
  });
});

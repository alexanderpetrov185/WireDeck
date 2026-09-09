import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of } from 'rxjs';
import { OpenAiProvider } from './openai.provider';
import { LoggerService } from '../../../common/logger/logger.service';

describe('OpenAiProvider — market impact parsing (Sprint 22a)', () => {
  let provider: OpenAiProvider;
  let httpPost: jest.Mock;

  const respondWith = (content: object | string) => {
    httpPost.mockReturnValue(
      of({
        data: {
          choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }],
        },
      }),
    );
  };

  beforeEach(async () => {
    httpPost = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAiProvider,
        { provide: ConfigService, useValue: { get: jest.fn((key: string, d?: unknown) => (key === 'AI_API_KEY' ? 'test-key' : d)) } },
        { provide: HttpService, useValue: { post: httpPost } },
        { provide: LoggerService, useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } },
      ],
    }).compile();
    provider = module.get(OpenAiProvider);
  });

  it('parses full impact payload from AI response', async () => {
    respondWith({
      summary: 'Fed raised rates.',
      importance: 0.9,
      category: 'economy',
      impactScore: 0.85,
      impactThesis: 'Rate-sensitive assets may move.',
      affectedAssets: ['oil', 'SPX', 'spx'],
      affectedSectors: ['Energy'],
      timeHorizon: 'intraday',
    });

    const result = await provider.summarize('text');

    expect(result.summary).toBe('Fed raised rates.');
    expect(result.impactScore).toBe(0.85);
    expect(result.impactThesis).toBe('Rate-sensitive assets may move.');
    // Токены uppercase + dedup.
    expect(result.affectedAssets).toBe('OIL,SPX');
    expect(result.affectedSectors).toBe('ENERGY');
    expect(result.timeHorizon).toBe('intraday');
  });

  it('clamps out-of-range impactScore and drops invalid horizon', async () => {
    respondWith({
      summary: 's',
      importance: 0.5,
      category: 'news',
      impactScore: 5,
      timeHorizon: 'tomorrow',
    });

    const result = await provider.summarize('text');

    expect(result.impactScore).toBe(1);
    expect(result.timeHorizon).toBeUndefined();
  });

  it('returns clean result without impact fields when AI omits them (legacy)', async () => {
    respondWith({ summary: 's', importance: 0.5, category: 'news' });

    const result = await provider.summarize('text');

    expect(result.impactScore).toBeUndefined();
    expect(result.impactThesis).toBeUndefined();
    expect(result.affectedAssets).toBeNull();
    expect(result.affectedSectors).toBeNull();
    expect(result.timeHorizon).toBeUndefined();
  });

  it('handles comma-string assets and sanitizes junk tokens', async () => {
    respondWith({
      summary: 's',
      importance: 0.5,
      category: 'news',
      impactScore: 0.7,
      affectedAssets: 'oil, !!!, very-long-ticker-that-exceeds-thirty-two-characters-limit!!!, BTC',
      affectedSectors: 'energy, banking',
    });

    const result = await provider.summarize('text');

    expect(result.affectedAssets).toBe('OIL,BTC');
    expect(result.affectedSectors).toBe('ENERGY,BANKING');
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { TelegramPublisherProvider } from './telegram-publisher.provider';
import { LoggerService } from '../../../common/logger/logger.service';

describe('TelegramPublisherProvider', () => {
  let provider: TelegramPublisherProvider;
  let httpService: HttpService;

  const mockConfig = (overrides: Record<string, string> = {}) => ({
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        TELEGRAM_BOT_TOKEN: 'test-token',
        TELEGRAM_CHANNEL_ID: '-100123456789',
        ...overrides,
      };
      return values[key] ?? defaultValue;
    }),
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramPublisherProvider,
        {
          provide: ConfigService,
          useValue: mockConfig(),
        },
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
          },
        },
      ],
    }).compile();

    provider = module.get<TelegramPublisherProvider>(TelegramPublisherProvider);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should throw if TELEGRAM_BOT_TOKEN is not configured', async () => {
    const module = await Test.createTestingModule({
      providers: [
        TelegramPublisherProvider,
        {
          provide: ConfigService,
          useValue: mockConfig({ TELEGRAM_BOT_TOKEN: '' }),
        },
        {
          provide: HttpService,
          useValue: { post: jest.fn() },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
        },
      ],
    }).compile();
    const p = module.get<TelegramPublisherProvider>(TelegramPublisherProvider);

    await expect(p.publish('hello')).rejects.toThrow('TELEGRAM_BOT_TOKEN is not configured');
    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('should throw if TELEGRAM_CHANNEL_ID is not configured', async () => {
    const module = await Test.createTestingModule({
      providers: [
        TelegramPublisherProvider,
        {
          provide: ConfigService,
          useValue: mockConfig({ TELEGRAM_CHANNEL_ID: '' }),
        },
        {
          provide: HttpService,
          useValue: { post: jest.fn() },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
        },
      ],
    }).compile();
    const p = module.get<TelegramPublisherProvider>(TelegramPublisherProvider);

    await expect(p.publish('hello')).rejects.toThrow('TELEGRAM_CHANNEL_ID is not configured');
    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('should return message_id on successful publish', async () => {
    (httpService.post as jest.Mock).mockReturnValue(
      of({
        data: { ok: true, result: { message_id: 123456 } },
      }),
    );

    const result = await provider.publish('hello');

    expect(result).toBe('123456');
    expect(httpService.post).toHaveBeenCalledWith(
      'https://api.telegram.org/bottest-token/sendMessage',
      expect.objectContaining({ chat_id: '-100123456789', text: 'hello' }),
      expect.objectContaining({ timeout: 15000 }),
    );
  });

  it('should throw on timeout', async () => {
    (httpService.post as jest.Mock).mockReturnValue(
      throwError(() => new Error('timeout of 15000ms exceeded')),
    );

    await expect(provider.publish('hello')).rejects.toThrow('Telegram publisher error');
  });

  it('should throw when response does not contain message_id', async () => {
    (httpService.post as jest.Mock).mockReturnValue(
      of({
        data: { ok: true, result: {} },
      }),
    );

    await expect(provider.publish('hello')).rejects.toThrow('Telegram response did not contain message_id');
  });

  it('should throw when response has ok:false', async () => {
    (httpService.post as jest.Mock).mockReturnValue(
      of({
        data: { ok: false, description: 'Bad Request: chat not found' },
      }),
    );

    await expect(provider.publish('hello')).rejects.toThrow('Telegram returned ok:false');
  });

  it('should throw when response is malformed (no data)', async () => {
    (httpService.post as jest.Mock).mockReturnValue(of({ data: undefined }));

    await expect(provider.publish('hello')).rejects.toThrow('Telegram returned ok:false');
  });

  it('should truncate very long message to safe limit with suffix', async () => {
    const longText = 'a'.repeat(10000);
    (httpService.post as jest.Mock).mockReturnValue(
      of({
        data: { ok: true, result: { message_id: 1 } },
      }),
    );

    await provider.publish(longText);

    const call = (httpService.post as jest.Mock).mock.calls[0];
    const sentText = call[1].text as string;

    // Длина не должна превышать безопасный лимит (4000).
    expect(sentText.length).toBeLessThanOrEqual(4000);
    // Должен быть понятный суффикс.
    expect(sentText.endsWith('… (truncated)')).toBe(true);
  });

  it('should not truncate short message', async () => {
    const shortText = 'short message';
    (httpService.post as jest.Mock).mockReturnValue(
      of({
        data: { ok: true, result: { message_id: 1 } },
      }),
    );

    await provider.publish(shortText);

    const call = (httpService.post as jest.Mock).mock.calls[0];
    expect(call[1].text).toBe(shortText);
  });
});
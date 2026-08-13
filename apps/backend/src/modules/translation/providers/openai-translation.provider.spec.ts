import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';
import { OpenAiTranslationProvider } from './openai-translation.provider';
import { LoggerService } from '../../../common/logger/logger.service';

describe('OpenAiTranslationProvider', () => {
  let provider: OpenAiTranslationProvider;
  let configService: ConfigService;
  let httpService: HttpService;
  let loggerService: LoggerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OpenAiTranslationProvider,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
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

    provider = module.get<OpenAiTranslationProvider>(OpenAiTranslationProvider);
    configService = module.get<ConfigService>(ConfigService);
    httpService = module.get<HttpService>(HttpService);
    loggerService = module.get<LoggerService>(LoggerService);
  });

  it('should be defined', () => {
    expect(provider).toBeDefined();
  });

  it('should successfully translate text', async () => {
    (configService.get as jest.Mock)
      .mockReturnValueOnce('test-api-key') // TRANSLATION_API_KEY
      .mockReturnValueOnce('https://api.example.com/v1/chat/completions') // TRANSLATION_PROVIDER_URL
      .mockReturnValueOnce('gpt-4o-mini'); // TRANSLATION_MODEL

    (httpService.post as jest.Mock).mockReturnValue(
      of({
        data: {
          choices: [
            {
              message: {
                content: 'Bu uzbek tilida tarjima.',
              },
            },
          ],
        },
      }),
    );

    const result = await provider.translate('This is a summary.', 'uz');

    expect(result).toBe('Bu uzbek tilida tarjima.');
    expect(httpService.post).toHaveBeenCalledWith(
      'https://api.example.com/v1/chat/completions',
      expect.objectContaining({
        model: 'gpt-4o-mini',
        messages: expect.any(Array),
      }),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer test-api-key',
        }),
      }),
    );
  });

  it('should throw when TRANSLATION_API_KEY is not configured', async () => {
    (configService.get as jest.Mock).mockReturnValue(''); // TRANSLATION_API_KEY

    await expect(provider.translate('Hello', 'uz')).rejects.toThrow(
      'TRANSLATION_API_KEY is not configured',
    );
    expect(httpService.post).not.toHaveBeenCalled();
  });

  it('should throw when response has no content', async () => {
    (configService.get as jest.Mock)
      .mockReturnValueOnce('test-api-key')
      .mockReturnValueOnce('https://api.example.com/v1/chat/completions')
      .mockReturnValueOnce('gpt-4o-mini');

    (httpService.post as jest.Mock).mockReturnValue(
      of({
        data: {
          choices: [
            {
              message: {
                content: null,
              },
            },
          ],
        },
      }),
    );

    await expect(provider.translate('Hello', 'uz')).rejects.toThrow(
      'Translation provider returned empty content',
    );
  });

  it('should throw when content is empty string', async () => {
    (configService.get as jest.Mock)
      .mockReturnValueOnce('test-api-key')
      .mockReturnValueOnce('https://api.example.com/v1/chat/completions')
      .mockReturnValueOnce('gpt-4o-mini');

    (httpService.post as jest.Mock).mockReturnValue(
      of({
        data: {
          choices: [
            {
              message: {
                content: '   ',
              },
            },
          ],
        },
      }),
    );

    await expect(provider.translate('Hello', 'uz')).rejects.toThrow(
      'Translation provider returned empty translation',
    );
  });

  it('should throw when HTTP request fails', async () => {
    (configService.get as jest.Mock)
      .mockReturnValueOnce('test-api-key')
      .mockReturnValueOnce('https://api.example.com/v1/chat/completions')
      .mockReturnValueOnce('gpt-4o-mini');

    (httpService.post as jest.Mock).mockReturnValue(
      throwError(() => new Error('Network error')),
    );

    await expect(provider.translate('Hello', 'uz')).rejects.toThrow(
      'Translation provider error: Network error',
    );
    expect(loggerService.error).toHaveBeenCalledWith(
      expect.stringContaining('Translation request failed'),
      expect.any(String),
      expect.any(String),
    );
  });

  it('should use default URL and model when env not set', async () => {
    // ConfigService.get(key, defaultValue) returns defaultValue when key is missing
    (configService.get as jest.Mock).mockImplementation((key: string, defaultValue?: string) => {
      if (key === 'TRANSLATION_API_KEY') return 'test-api-key';
      return defaultValue; // URL and model fall back to defaults
    });

    (httpService.post as jest.Mock).mockReturnValue(
      of({
        data: {
          choices: [
            {
              message: {
                content: 'Tarjima.',
              },
            },
          ],
        },
      }),
    );

    const result = await provider.translate('Hello', 'uz');

    expect(result).toBe('Tarjima.');
    expect(httpService.post).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({
        model: 'gpt-4o-mini',
      }),
      expect.any(Object),
    );
  });
});

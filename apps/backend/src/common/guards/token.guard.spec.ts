import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { TokenGuard } from './token.guard';

describe('TokenGuard', () => {
  let guard: TokenGuard;
  let configService: ConfigService;

  const mockContext = (headers: Record<string, string | undefined>): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ headers }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenGuard,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<TokenGuard>(TokenGuard);
    configService = module.get<ConfigService>(ConfigService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should deny access when INGESTION_TOKEN is empty', () => {
    (configService.get as jest.Mock).mockReturnValue('');

    const result = guard.canActivate(mockContext({ 'x-ingestion-token': 'anything' }));

    expect(result).toBe(false);
  });

  it('should deny access when token is missing', () => {
    (configService.get as jest.Mock).mockReturnValue('secret-token');

    const result = guard.canActivate(mockContext({}));

    expect(result).toBe(false);
  });

  it('should deny access when token is wrong', () => {
    (configService.get as jest.Mock).mockReturnValue('secret-token');

    const result = guard.canActivate(mockContext({ 'x-ingestion-token': 'wrong-token' }));

    expect(result).toBe(false);
  });

  it('should allow access when token matches', () => {
    (configService.get as jest.Mock).mockReturnValue('secret-token');

    const result = guard.canActivate(mockContext({ 'x-ingestion-token': 'secret-token' }));

    expect(result).toBe(true);
  });
});

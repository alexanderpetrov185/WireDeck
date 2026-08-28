import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { ComplianceService } from './compliance.service';
import { LoggerService } from '../../common/logger/logger.service';

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  readFileSync: jest.fn(),
}));

const mockReadFileSync = readFileSync as jest.Mock;

const VALID_CONFIG = {
  foreign_agent: {
    action: 'label',
    footnote: 'FA footnote text.',
    terms: ['Example Foreign Agent Name'],
  },
  terror_extremist: {
    action: 'block',
    terms: ['Example Extremist Org'],
  },
};

describe('ComplianceService', () => {
  let service: ComplianceService;
  let loggerService: LoggerService;

  async function createService(env: Record<string, string | undefined>) {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ComplianceService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn((key: string, d?: unknown) => env[key] ?? d) },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
        },
      ],
    }).compile();
    const svc = module.get(ComplianceService);
    const logger = module.get(LoggerService);
    // onModuleInit читает файл — вызываем явно (аналог lifecycle).
    await svc.onModuleInit();
    return { svc, logger };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should be disabled when COMPLIANCE_LISTS_PATH is not set', async () => {
    ({ svc: service, logger: loggerService } = await createService({ COMPLIANCE_LISTS_PATH: undefined }));

    const result = service.scan('anything with Example Foreign Agent Name');

    expect(result).toEqual({ labels: [], footnotes: [], blocked: false, matches: [] });
    expect(loggerService.warn).toHaveBeenCalledWith(
      expect.stringContaining('disabled'),
      expect.any(String),
    );
  });

  it('should be disabled and log error when file is unreadable', async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('ENOENT');
    });

    ({ svc: service, logger: loggerService } = await createService({
      COMPLIANCE_LISTS_PATH: '/bad/path.json',
    }));

    expect(service.scan('Example Foreign Agent Name').labels).toEqual([]);
    expect(loggerService.error).toHaveBeenCalledWith(
      expect.stringContaining('failed to load lists'),
      expect.anything(),
      expect.any(String),
    );
  });

  it('should load valid config and log resolved state', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(VALID_CONFIG));

    ({ svc: service, logger: loggerService } = await createService({
      COMPLIANCE_LISTS_PATH: '/lists.json',
    }));

    expect(service.scan('clean text')).toEqual({ labels: [], footnotes: [], blocked: false, matches: [] });
    expect(loggerService.log).toHaveBeenCalledWith(
      expect.stringContaining('Compliance labeling enabled'),
      expect.any(String),
    );
  });

  it('should detect case-insensitive label match (foreign_agent)', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(VALID_CONFIG));
    ({ svc: service } = await createService({ COMPLIANCE_LISTS_PATH: '/lists.json' }));

    const result = service.scan('News about EXAMPLE FOREIGN AGENT NAME today');

    expect(result.labels).toEqual(['foreign_agent']);
    expect(result.footnotes).toEqual(['FA footnote text.']);
    expect(result.blocked).toBe(false);
    expect(result.matches[0]).toMatchObject({ category: 'foreign_agent', term: 'Example Foreign Agent Name' });
  });

  it('should block on terror_extremist match', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(VALID_CONFIG));
    ({ svc: service } = await createService({ COMPLIANCE_LISTS_PATH: '/lists.json' }));

    const result = service.scan('Mentions of Example Extremist Org in report');

    expect(result.labels).toEqual(['terror_extremist']);
    expect(result.blocked).toBe(true);
    expect(result.footnotes).toEqual([]);
  });

  it('should collect multiple categories and dedupe footnotes', async () => {
    mockReadFileSync.mockReturnValue(JSON.stringify(VALID_CONFIG));
    ({ svc: service } = await createService({ COMPLIANCE_LISTS_PATH: '/lists.json' }));

    const result = service.scan('Both Example Foreign Agent Name and Example Extremist Org mentioned');

    expect(result.labels.sort()).toEqual(['foreign_agent', 'terror_extremist']);
    expect(result.blocked).toBe(true);
  });

  it('should skip invalid category configs at load time', async () => {
    mockReadFileSync.mockReturnValue(
      JSON.stringify({
        broken: { action: 'unknown_action', terms: ['X'] },
        empty_terms: { action: 'label', terms: [] },
        ...VALID_CONFIG,
      }),
    );

    ({ svc: service, logger: loggerService } = await createService({
      COMPLIANCE_LISTS_PATH: '/lists.json',
    }));

    const result = service.scan('x Example Foreign Agent Name y');
    expect(result.labels).toEqual(['foreign_agent']);
    expect(loggerService.warn).toHaveBeenCalledWith(
      expect.stringContaining('invalid compliance category'),
      expect.any(String),
    );
  });
});
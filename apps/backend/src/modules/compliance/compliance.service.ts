import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFileSync } from 'fs';
import { LoggerService } from '../../common/logger/logger.service';

/**
 * Sprint 19: RF compliance labeling (иноагенты / терроризм-экстремизм / нежелательные организации).
 *
 * - Списки загружаются из JSON-файла (env COMPLIANCE_LISTS_PATH). Без хардкода в бизнес-логике.
 * - Оператор сам ведёт и актуализирует списки и формулировки сносок (см. docs/compliance.md).
 * - Если COMPLIANCE_LISTS_PATH не задан — фича выключена (все новости считаются clean).
 * - Если файл задан, но не читается/битый — error-лог, фича off (не блокируем запуск).
 *
 * Matching: case-insensitive substring по итоговому тексту поста. Не ML.
 */

export type ComplianceAction = 'label' | 'block';

export interface ComplianceCategoryConfig {
  action: ComplianceAction;
  footnote?: string;
  terms: string[];
}

export interface ComplianceMatch {
  category: string;
  action: ComplianceAction;
  term: string;
}

export interface ComplianceScanResult {
  /** Категории, найденные в тексте (для хранения в DB / admin badges). */
  labels: string[];
  /** Сноски для label-категорий (append в конец поста). */
  footnotes: string[];
  /** true, если найдена хотя бы одна block-категория — автопубликация запрещена. */
  blocked: boolean;
  /** Детали совпадений для логов. */
  matches: ComplianceMatch[];
}

const EMPTY_RESULT: ComplianceScanResult = { labels: [], footnotes: [], blocked: false, matches: [] };

@Injectable()
export class ComplianceService implements OnModuleInit {
  private readonly context = 'ComplianceService';
  private categories: Record<string, ComplianceCategoryConfig> = {};
  private enabled = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit(): void {
    const path = this.configService.get<string>('COMPLIANCE_LISTS_PATH', '');
    if (!path) {
      this.logger.warn(
        'Compliance labeling disabled: COMPLIANCE_LISTS_PATH is not configured. All news treated as clean.',
        this.context,
      );
      return;
    }

    try {
      const raw = readFileSync(path, 'utf8');
      const parsed = JSON.parse(raw) as Record<string, ComplianceCategoryConfig>;

      // Валидация: действие только label|block, terms — непустые строки.
      this.categories = {};
      let termCount = 0;
      for (const [category, cfg] of Object.entries(parsed)) {
        if (!cfg || !Array.isArray(cfg.terms) || (cfg.action !== 'label' && cfg.action !== 'block')) {
          this.logger.warn(`Skipping invalid compliance category "${category}"`, this.context);
          continue;
        }
        const terms = cfg.terms
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .map((t) => t.trim());
        this.categories[category] = { action: cfg.action, footnote: cfg.footnote?.trim(), terms };
        termCount += terms.length;
      }

      this.enabled = true;
      this.logger.log(
        `Compliance labeling enabled: ${Object.keys(this.categories).length} category(ies), ${termCount} term(s), path=${path}`,
        this.context,
      );
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Compliance labeling disabled: failed to load lists from "${path}": ${msg}`,
        error instanceof Error ? error.stack : undefined,
        this.context,
      );
    }
  }

  /**
   * Сканирует итоговый текст поста на совпадения со списками.
   * Case-insensitive substring matching. Если фича выключена — clean.
   */
  scan(text: string): ComplianceScanResult {
    if (!this.enabled || !text) {
      return EMPTY_RESULT;
    }

    const lowerText = text.toLowerCase();
    const labels: string[] = [];
    const footnotes: string[] = [];
    const matches: ComplianceMatch[] = [];
    let blocked = false;

    for (const [category, cfg] of Object.entries(this.categories)) {
      const matchedTerm = cfg.terms.find((term) => lowerText.includes(term.toLowerCase()));
      if (!matchedTerm) {
        continue;
      }

      labels.push(category);
      matches.push({ category, action: cfg.action, term: matchedTerm });

      if (cfg.action === 'block') {
        blocked = true;
      } else if (cfg.footnote && !footnotes.includes(cfg.footnote)) {
        footnotes.push(cfg.footnote);
      }
    }

    return { labels, footnotes, blocked, matches };
  }
}
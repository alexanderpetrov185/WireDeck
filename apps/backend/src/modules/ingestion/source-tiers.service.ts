import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../common/logger/logger.service';
import * as fs from 'fs';

/** Допустимые значения tier. */
const VALID_TIERS = [1, 2, 3];
const DEFAULT_TIER = 2;

/**
 * Sprint 22b: резолвинг source tier (1|2|3) по имени источника.
 * Конфиг — operator-editable JSON файл (SOURCE_TIERS_PATH), по образцу
 * compliance-списков (Sprint 19):
 *   { "bySourceName": { "CNBC": 1, "Reuters": 1 }, "default": 2 }
 *
 * Fail-open: файл отсутствует/битый/конфиг пуст → disabled, resolve()
 * возвращает default tier 2 (gating работает по обычному порогу).
 * Файл читается один раз при старте (обновление — рестарт backend).
 */
@Injectable()
export class SourceTiersService implements OnModuleInit {
  private readonly context = 'SourceTiersService';
  private readonly bySourceName = new Map<string, number>();
  private defaultTier = DEFAULT_TIER;
  private enabled = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit(): void {
    const path = this.configService.get<string>('SOURCE_TIERS_PATH', '');
    if (!path) {
      this.logger.warn(
        'Source tiers config not set (SOURCE_TIERS_PATH empty) — all sources default to tier 2',
        this.context,
      );
      return;
    }

    try {
      const raw = fs.readFileSync(path, 'utf8');
      const parsed = JSON.parse(raw);

      if (parsed && typeof parsed === 'object' && typeof parsed.bySourceName === 'object') {
        for (const [name, tier] of Object.entries(parsed.bySourceName)) {
          const t = Number(tier);
          if (!VALID_TIERS.includes(t)) {
            this.logger.warn(`Invalid tier ${tier} for source "${name}", skipping`, this.context);
            continue;
          }
          this.bySourceName.set(name.trim().toLowerCase(), t);
        }
      }

      if (parsed && VALID_TIERS.includes(Number(parsed.default))) {
        this.defaultTier = Number(parsed.default);
      }

      this.enabled = this.bySourceName.size > 0;
      if (this.enabled) {
        this.logger.log(
          `Source tiers loaded: ${this.bySourceName.size} named source(s), default=${this.defaultTier} (path=${path})`,
          this.context,
        );
      } else {
        this.logger.warn(`Source tiers config has no valid entries — all sources default to tier ${this.defaultTier}`, this.context);
      }
    } catch (error) {
      this.enabled = false;
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to load source tiers config from ${path}: ${msg} — all sources default to tier 2`,
        error instanceof Error ? error.stack : undefined,
        this.context,
      );
    }
  }

  /**
   * Tier источника по имени. Case-insensitive, trim.
   * Сначала точное совпадение, затем substring (feed.title часто длиннее
   * ключа конфига: "CNBC" матчит "CNBC: Top News & Analysis").
   * Не найдено / disabled → default tier (2).
   */
  resolve(sourceName: string | null | undefined): number {
    if (sourceName) {
      const name = sourceName.trim().toLowerCase();
      if (!name) {
        return this.defaultTier;
      }
      const exact = this.bySourceName.get(name);
      if (exact !== undefined) {
        return exact;
      }
      for (const [key, tier] of this.bySourceName) {
        if (name.includes(key) || key.includes(name)) {
          return tier;
        }
      }
    }
    return this.defaultTier;
  }
}

import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '../../../../common/logger/logger.service';
import * as fs from 'fs';

export interface WatchlistEntry {
  handle: string;
  tier: number;
  unconfirmed: boolean;
  note?: string;
}

const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;
const VALID_TIERS = [1, 2, 3];
const MAX_ENTRIES = 50;

/**
 * Sprint 22c: watchlist Twitter/X аккаунтов (operator-editable JSON,
 * по образцу compliance/source.tiers). Без ключа vendor'а файл не используется
 * ни для каких HTTP-вызовов — это только конфиг.
 *
 * Fail-open: файл отсутствует/битый → disabled, пустой watchlist.
 */
@Injectable()
export class TwitterWatchlistService implements OnModuleInit {
  private readonly context = 'TwitterWatchlistService';
  private readonly entries: WatchlistEntry[] = [];
  private enabled = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  onModuleInit(): void {
    const path = this.configService.get<string>('TWITTER_WATCHLIST_PATH', '');
    if (!path) {
      this.logger.warn('Twitter watchlist not configured (TWITTER_WATCHLIST_PATH empty) — collector disabled', this.context);
      return;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(path, 'utf8'));
      if (!Array.isArray(parsed)) {
        throw new Error('watchlist must be a JSON array');
      }

      for (const item of parsed.slice(0, MAX_ENTRIES)) {
        const handle = typeof item?.handle === 'string' ? item.handle.trim().replace(/^@/, '') : '';
        const tier = Number(item?.tier);
        if (!HANDLE_RE.test(handle)) {
          this.logger.warn(`Invalid Twitter handle "${item?.handle}", skipping`, this.context);
          continue;
        }
        if (!VALID_TIERS.includes(tier)) {
          this.logger.warn(`Invalid tier for @${handle}, skipping`, this.context);
          continue;
        }
        this.entries.push({
          handle,
          tier,
          unconfirmed: item?.unconfirmed === true,
          note: typeof item?.note === 'string' ? item.note : undefined,
        });
      }

      this.enabled = this.entries.length > 0;
      if (this.enabled) {
        this.logger.log(
          `Twitter watchlist loaded: ${this.entries.length} account(s) (path=${path})`,
          this.context,
        );
      } else {
        this.logger.warn('Twitter watchlist has no valid entries — collector disabled', this.context);
      }
    } catch (error) {
      this.enabled = false;
      const msg = error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to load Twitter watchlist from ${path}: ${msg} — collector disabled`,
        error instanceof Error ? error.stack : undefined,
        this.context,
      );
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  getEntries(): WatchlistEntry[] {
    return this.entries;
  }
}

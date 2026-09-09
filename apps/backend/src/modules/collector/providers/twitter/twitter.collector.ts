// Twitter/X-коллектор (Sprint 22c).
// HARD COST RULE: без TWITTER_API_KEY или с пустым watchlist — DISABLED,
// ни одного исходящего HTTP-вызова (zero spend по умолчанию).
// Vendor: дешёвые REST-провайдеры (twitterapi.io / socialdata.tools,
// ~$0.15-0.30/1k tweets → ~$1-4/мес при 15 аккаунтах × несколько
// polling'ов в день). Официальный X API ($100/мес), скрапинг и Nitter —
// out of scope (см. docs).

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { NewsSource } from '../../../news/constants/news-source.enum';
import { NewsCollector } from '../../interfaces/news-collector.interface';
import { CollectedNews } from '../../interfaces/collected-news.interface';
import { LoggerService } from '../../../../common/logger/logger.service';
import { NewsLanguage } from '../../../news/constants/news-language.enum';
import { TwitterWatchlistService } from './twitter-watchlist.service';

const DEFAULT_VENDOR_URL = 'https://api.twitterapi.io';
const DEFAULT_POLL_LIMIT = 15;
const DEFAULT_MAX_PER_DAY = 500;
const REQUEST_TIMEOUT_MS = 10000;
const CIRCUIT_BREAKER_THRESHOLD = 5; // подряд неудачных тиков
const CIRCUIT_BREAKER_COOLDOWN_MS = 10 * 60 * 1000;

interface VendorTweet {
  id: string;
  text: string;
  createdAt?: string;
}

@Injectable()
export class TwitterCollector implements NewsCollector {
  readonly source = NewsSource.TWITTER;
  private readonly context = 'TwitterCollector';
  private dailyCount = 0;
  private dailyCountDate = new Date().toDateString();
  private consecutiveFailures = 0;
  private breakerOpenUntil = 0;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly watchlist: TwitterWatchlistService,
    private readonly logger: LoggerService,
  ) {}

  async collect(_since?: Date): Promise<CollectedNews[]> {
    const apiKey = this.configService.get<string>('TWITTER_API_KEY', '');
    if (!apiKey) {
      // Zero-cost по умолчанию: ни одного вызова без ключа.
      return [];
    }
    if (!this.watchlist.isEnabled()) {
      return [];
    }
    if (Date.now() < this.breakerOpenUntil) {
      this.logger.warn('Twitter circuit breaker open, skipping this tick', this.context);
      return [];
    }

    const limit = Math.max(
      1,
      Number(this.configService.get<number>('TWITTER_POLL_LIMIT', DEFAULT_POLL_LIMIT)) || DEFAULT_POLL_LIMIT,
    );
    const maxPerDay = Math.max(
      1,
      Number(this.configService.get<number>('TWITTER_MAX_PER_DAY', DEFAULT_MAX_PER_DAY)) || DEFAULT_MAX_PER_DAY,
    );
    this.rollDailyCounter();

    const handles = this.watchlist.getEntries().slice(0, limit);
    const vendorUrl = this.configService.get<string>('TWITTER_VENDOR_URL', DEFAULT_VENDOR_URL);
    let failedRequests = 0;
    let okRequests = 0;
    const results: CollectedNews[] = [];

    await Promise.allSettled(
      handles.map(async (entry) => {
        if (this.dailyCount >= maxPerDay) {
          return; // дневной бюджет исчерпан — тихо пропускаем
        }
        try {
          const response = await firstValueFrom(
            this.httpService.get(`${vendorUrl}/user/last_tweets`, {
              params: { userName: entry.handle },
              headers: { 'X-API-Key': apiKey },
              timeout: REQUEST_TIMEOUT_MS,
            }),
          );
          const tweets: VendorTweet[] = Array.isArray(response.data?.tweets) ? response.data.tweets : [];
          this.dailyCount += 1; // 1 запрос = 1 тарифицируемое обращение
          okRequests += 1;
          for (const tweet of tweets) {
            const mapped = this.mapTweet(tweet, entry.handle, entry.tier, entry.unconfirmed);
            if (mapped) {
              results.push(mapped);
            }
          }
        } catch (error) {
          failedRequests += 1;
          const msg = error instanceof Error ? error.message : String(error);
          this.logger.warn(`Twitter fetch failed for @${entry.handle}: ${msg}`, this.context);
        }
      }),
    );

    // Circuit breaker: подряд неудачные тики → пауза (экономит кредиты при даунтайме).
    if (okRequests === 0 && failedRequests > 0) {
      this.consecutiveFailures += 1;
      if (this.consecutiveFailures >= CIRCUIT_BREAKER_THRESHOLD) {
        this.breakerOpenUntil = Date.now() + CIRCUIT_BREAKER_COOLDOWN_MS;
        this.logger.error(
          `Twitter circuit breaker OPEN for ${CIRCUIT_BREAKER_COOLDOWN_MS / 60000} min after ${this.consecutiveFailures} failed ticks`,
          this.context,
        );
      }
    } else if (okRequests > 0) {
      this.consecutiveFailures = 0;
    }

    if (results.length > 0 || failedRequests > 0) {
      this.logger.log(
        `Twitter collection: ${results.length} tweet(s) from ${okRequests}/${handles.length} account(s), ` +
          `daily usage ${this.dailyCount}/${maxPerDay}`,
        this.context,
      );
    }
    return results;
  }

  private rollDailyCounter(): void {
    const today = new Date().toDateString();
    if (this.dailyCountDate !== today) {
      this.dailyCountDate = today;
      this.dailyCount = 0;
    }
  }

  /** Tweet → CollectedNews. Невалидные записи пропускаются. */
  private mapTweet(
    tweet: VendorTweet,
    handle: string,
    tier: number,
    unconfirmed: boolean,
  ): CollectedNews | null {
    if (!tweet?.id || typeof tweet.text !== 'string' || tweet.text.trim().length === 0) {
      return null;
    }
    const text = tweet.text.trim().slice(0, 4000);
    return {
      sourceId: tweet.id,
      source: NewsSource.TWITTER,
      sourceName: `X: @${handle}`,
      author: `@${handle}`,
      sourceUrl: `https://x.com/${handle}/status/${tweet.id}`,
      rawText: text,
      sourceLanguage: NewsLanguage.EN,
      category: null,
      publishedAt: tweet.createdAt ? new Date(tweet.createdAt) : null,
      tierOverride: tier,
      unconfirmedOverride: unconfirmed,
    };
  }
}

// Константы Pipeline-модуля (Sprint 9: Scheduler + BullMQ)
// Названия очереди, job и jobId, используемые для дедупликации scheduled runs.

export const PIPELINE_QUEUE_NAME = 'wiredeck-pipeline';
export const PIPELINE_JOB_NAME = 'full-pipeline';

// Фиксированный jobId для scheduled-запусков.
// Позволяет BullMQ дедуплицировать параллельные enqueue (active/waiting/delayed).
// После завершения (completed/failed) job с тем же jobId может быть добавлен снова.
export const PIPELINE_JOB_ID = 'scheduled-full-pipeline';

// Порог, ниже которого интервал считается некорректным (защита от 0/негатива).
export const MIN_PIPELINE_INTERVAL_MS = 5000;

// Дефолтные значения (переопределяются через env).
export const DEFAULT_SCHEDULER_ENABLED = false;
export const DEFAULT_PIPELINE_INTERVAL_MS = 600000; // 10 минут
// Sprint 12: снижено с 50 — free-tier Groq (429) не должен сжигать весь прогон.
export const DEFAULT_PIPELINE_BATCH_LIMIT = 10;

// Sprint 12: retry при rate limit (429) у AI/translation провайдеров.
export const DEFAULT_AI_RATE_LIMIT_RETRIES = 2;
export const DEFAULT_AI_RATE_LIMIT_BASE_DELAY_MS = 2000;

// Sprint 14: moderation policy.
export type ModerationMode = 'manual' | 'auto' | 'hybrid';
export const MODERATION_MODES: ModerationMode[] = ['manual', 'auto', 'hybrid'];
export const DEFAULT_MODERATION_MODE: ModerationMode = 'auto';
export const DEFAULT_MODERATION_AUTO_IMPORTANCE_MIN = 0.6;

// Sprint 22a: market-impact publish gating.
// Автопубликация требует И importance И impact порогов (когда impactScore известен).
export const DEFAULT_IMPACT_GATE_ENABLED = true;
export const DEFAULT_IMPACT_PUBLISH_MIN = 0.5;
// Смягчённый порог для tier-1 источников (официальные/макро). Применяется,
// только если у новости проставлен sourceTier=1.
export const DEFAULT_IMPACT_TIER1_MIN = 0.4;

// Настройки BullMQ (не путать с timeout'ом!)
// lockDuration — это время, в течение которого Worker удерживает lock на job
// для механизма stalled-job detection. Продлевается автоматически при активной обработке.
export const PIPELINE_LOCK_DURATION = 120000; // 120 сек
export const PIPELINE_ATTEMPTS = 3;
export const PIPELINE_BACKOFF_DELAY_MS = 5000;
export const PIPELINE_MAX_RETRIES_PER_REQUEST = null; // Worker: важно для длинных операций
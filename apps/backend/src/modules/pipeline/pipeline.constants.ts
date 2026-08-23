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
export const DEFAULT_PIPELINE_BATCH_LIMIT = 50;

// Настройки BullMQ (не путать с timeout'ом!)
// lockDuration — это время, в течение которого Worker удерживает lock на job
// для механизма stalled-job detection. Продлевается автоматически при активной обработке.
export const PIPELINE_LOCK_DURATION = 120000; // 120 сек
export const PIPELINE_ATTEMPTS = 3;
export const PIPELINE_BACKOFF_DELAY_MS = 5000;
export const PIPELINE_MAX_RETRIES_PER_REQUEST = null; // Worker: важно для длинных операций
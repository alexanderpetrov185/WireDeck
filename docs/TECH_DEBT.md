# WireDeck — Technical Debt Register

Документ фиксирует известный технический долг проекта.
Каждая запись содержит уникальный ID, описание, приоритет, влияние, планируемый спринт и статус.

## Приоритеты

- **HIGH** — блокирует развитие, влияет на production
- **MEDIUM** — влияет на качество/безопасность, но не блокирует
- **LOW** — косметические/улучшения

## Реестр

| ID | Description | Priority | Impact | Planned Sprint | Status |
|----|-------------|----------|--------|----------------|--------|
| TD-001 | `@sentry/tracing` removed from package.json; verify no Sentry tracing features are lost | MEDIUM | Sentry tracing sample rates still work via `@sentry/node`, but no explicit tracing package | Sprint 11 (Reliability) | OPEN |
| TD-002 | Frontend admin panel contains hardcoded mock data (newsCount=42, botStatus='online', fake news table) | MEDIUM | Users see fake data; no real backend integration | Sprint 10 (Frontend Admin) | OPEN |
| TD-003 | `eslint.config.js` triggers MODULE_TYPELESS_PACKAGE_JSON warning in backend | LOW | Performance overhead on lint startup; confusing warning | Sprint 11 | OPEN |
| TD-004 | TypeScript `baseUrl` is deprecated (TS 7.0 will remove it); tsconfig needs `ignoreDeprecations: "6.0"` or restructure | LOW | Build will break when upgrading to TS 7.0 | Sprint 11 | OPEN |
| TD-005 | Jest globals (`describe`, `test`, `expect`) not recognized by tsconfig types; requires explicit `@types/jest` in types field | MEDIUM | IDE shows false TypeScript errors in spec files | Sprint 11 | OPEN |
| TD-006 | Hardcoded default credentials (postgres/postgres) and placeholder API keys in `.env.example` and `compose.yaml` | HIGH | Production misconfiguration risk; security concern | Sprint 11 (Production Readiness) | OPEN |
| TD-007 | `docker compose` warnings when env vars (AI_PROVIDER_URL, TRANSLATION_*, etc.) are not set | LOW | Noisy startup; user confusion | Sprint 11 | OPEN |
| TD-008 | `supertest@7.0.0` and `superagent@9.0.2` are deprecated; rely on community maintenance | LOW | No immediate impact; watch for vulnerabilities | Sprint 11 | OPEN |
| TD-009 | `apps/frontend/src/lib/sentry/sentry.config.js` has duplicate/unused webpack plugin logic; `@sentry/webpack-plugin` used directly | LOW | Potential double sourcemap upload; confusing config | Sprint 11 | OPEN |
| TD-010 | TypeORM `DataSource` config duplicated between `app.module.ts` (inline) and `data-source.ts` (CLI); drift risk | MEDIUM | Config changes may not apply consistently | Sprint 11 | OPEN |
| TD-011 | RSS collector `mapToCollectedNews` uses `any` type for feed items | LOW | Type safety gap; potential runtime errors | Sprint 11 | OPEN |
| TD-012 | Frontend layout initializes Sentry only on client (`typeof window !== 'undefined'`); server-side Sentry (`sentry.server.ts`) not wired to Next.js instrumentation | MEDIUM | Server errors not fully captured | Sprint 11 | OPEN |
| TD-013 | Backend logs directory (`apps/backend/logs/`) is inside source tree; should be git-ignored | LOW | Repository bloat; log leakage risk | Sprint 11 | OPEN |
| TD-014 | No CI/CD pipeline configured in `.github/workflows/` despite documentation referencing it | HIGH | No automated validation on PRs; regressions possible | Sprint 11 | OPEN |
| TD-015 | TranslationService validates target language via `NewsLanguage` enum, but `targetLanguage` is passed as loose `string` type in service | LOW | Type safety gap; could be narrowed to `NewsLanguage` | Sprint 11 | OPEN |
| TD-016 | `translatePending` with `force` may process duplicate IDs (PROCESSED + TRANSLATED overlap) | LOW | Potential double-processing edge case | Sprint 11 | OPEN |
| TD-017 | `News` entity `telegramMessageId` stored as `bigint` string; TypeORM may return it as string or number inconsistently | MEDIUM | Potential serialization issues in API responses | Sprint 8 (Publishing) | OPEN |
| TD-018 | Health check pings external `https://docs.nestjs.com` — could fail in offline/air-gapped environments | MEDIUM | False negative health status | Sprint 11 | OPEN |
| TD-019 | No tests for `NewsService` (only ingestion/translation/collector/hash tests exist) | MEDIUM | Core domain service has no unit test coverage | Sprint 11 | OPEN |
| TD-020 | Frontend `page.tsx` imports `useState`, `useEffect` with `'use client'` but relies on simulated data; no API client layer exists | MEDIUM | No real backend communication from frontend | Sprint 10 (Frontend Admin) | OPEN |
| TD-021 | `TRANSLATED → QUEUED` transition not implemented — news never enters moderation queue automatically | MEDIUM | Pipeline break — news stays in TRANSLATED, never reaches moderation | Sprint 7.2 | RESOLVED |

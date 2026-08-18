import type { AiProvider } from '../../prisma/generated/client/enums'

// Конфіг AI-шару: сервісні (fallback) ключі, БАЗОВІ моделі, провайдер за
// замовчуванням та ліміти безкоштовної квоти.
// Значення читаються з env (NUXT_AI_*) і слугують ЛИШЕ базою — персональні
// налаштування користувача (server/ai/settings.ts) мають вищий пріоритет.

/** Базові моделі для кожного провайдера (env; перевизначаються налаштуваннями користувача). */
export const DEFAULT_MODELS: Record<AiProvider, string> = {
  OPENAI: process.env.NUXT_AI_OPENAI_MODEL ?? 'gpt-4o-mini',
  // Claude 3.x/3.5 виведені з експлуатації — беремо актуальний економний Haiku 4.5.
  ANTHROPIC: process.env.NUXT_AI_ANTHROPIC_MODEL ?? 'claude-haiku-4-5',
  // Аліас «останній Flash» — не застаріває (gemini-1.5-flash вже вимкнено Google).
  GEMINI: process.env.NUXT_AI_GEMINI_MODEL ?? 'gemini-flash-latest',
}

/** Сервісні (fallback) ключі — по одному на провайдера. Порожній рядок → немає. */
export function serviceKey(provider: AiProvider): string | null {
  const raw =
    provider === 'OPENAI'
      ? process.env.NUXT_AI_OPENAI_API_KEY
      : provider === 'ANTHROPIC'
        ? process.env.NUXT_AI_ANTHROPIC_API_KEY
        : process.env.NUXT_AI_GEMINI_API_KEY

  const trimmed = raw?.trim()
  return trimmed ? trimmed : null
}

/** Усі провайдери, для яких налаштований сервісний ключ. */
export function providersWithServiceKey(): AiProvider[] {
  return (['OPENAI', 'ANTHROPIC', 'GEMINI'] as const).filter((p) => serviceKey(p) !== null)
}

/**
 * Провайдер за замовчуванням для fallback.
 * Пріоритет: явний NUXT_AI_DEFAULT_PROVIDER → перший провайдер із сервісним ключем.
 */
export function defaultServiceProvider(): AiProvider | null {
  const explicit = process.env.NUXT_AI_DEFAULT_PROVIDER?.trim().toUpperCase()
  if (explicit === 'OPENAI' || explicit === 'ANTHROPIC' || explicit === 'GEMINI') {
    if (serviceKey(explicit) !== null) return explicit
  }
  return providersWithServiceKey()[0] ?? null
}

/** Ліміт безкоштовних AI-запитів на сервісному ключі за період. */
export function freeQuotaLimit(): number {
  const n = Number(process.env.NUXT_AI_FREE_QUOTA_LIMIT)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 20
}

/** Тривалість періоду безкоштовної квоти (дні). */
export function freeQuotaPeriodMs(): number {
  const days = Number(process.env.NUXT_AI_FREE_QUOTA_PERIOD_DAYS)
  const resolved = Number.isFinite(days) && days > 0 ? days : 30
  return resolved * 24 * 60 * 60 * 1000
}

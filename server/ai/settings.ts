import { z } from 'zod'
import type { AiProvider } from '../../prisma/generated/client/enums'
import { prisma } from '../utils/prisma'
import {
  DEFAULT_MODELS,
  defaultServiceProvider,
  freeQuotaLimit,
  freeQuotaPeriodMs,
  serviceKey,
} from './config'

const ALL_PROVIDERS: AiProvider[] = ['OPENAI', 'ANTHROPIC', 'GEMINI']

// Персональні (per-user) налаштування AI. Значення користувача мають пріоритет,
// а env (DEFAULT_MODELS / defaultServiceProvider) слугує лише БАЗОВИМ дефолтом.

/** Ефективні налаштування після накладання user-значень поверх env-бази. */
export interface EffectiveAiSettings {
  /** Бажаний провайдер користувача (null → базовий із env вибереться при fallback). */
  preferredProvider: AiProvider | null
  /** Ефективна модель для кожного провайдера (user override або env base). */
  models: Record<AiProvider, string>
}

/** Trim + порожній рядок → null. */
function cleanModel(value: string | null | undefined): string | null {
  const v = value?.trim()
  return v ? v : null
}

/**
 * Завантажує налаштування користувача й накладає їх поверх env-бази.
 * Якщо запису немає — повертає повністю базові (env) значення.
 */
export async function resolveUserAiSettings(userId: string): Promise<EffectiveAiSettings> {
  const s = await prisma.userAiSetting.findUnique({ where: { userId } })

  return {
    preferredProvider: s?.preferredProvider ?? null,
    models: {
      OPENAI: cleanModel(s?.openaiModel) ?? DEFAULT_MODELS.OPENAI,
      ANTHROPIC: cleanModel(s?.anthropicModel) ?? DEFAULT_MODELS.ANTHROPIC,
      GEMINI: cleanModel(s?.geminiModel) ?? DEFAULT_MODELS.GEMINI,
    },
  }
}

/** Ефективна модель для конкретного провайдера. */
export function effectiveModel(settings: EffectiveAiSettings, provider: AiProvider): string {
  return settings.models[provider]
}

// ── Валідація для settings-роуту ────────────────────────────────────────
export const aiProviderSchema = z.enum(['OPENAI', 'ANTHROPIC', 'GEMINI'])

/** Оновлення налаштувань: усі поля опційні; null/порожньо → повернення до env-бази. */
export const aiSettingsUpdateSchema = z.object({
  preferredProvider: aiProviderSchema.nullish(),
  openaiModel: z.string().trim().max(100, 'Задовга назва моделі').nullish(),
  anthropicModel: z.string().trim().max(100, 'Задовга назва моделі').nullish(),
  geminiModel: z.string().trim().max(100, 'Задовга назва моделі').nullish(),
})

export type AiSettingsUpdateInput = z.infer<typeof aiSettingsUpdateSchema>

/** Upsert персональних налаштувань і повернення ефективних значень. */
export async function upsertUserAiSettings(
  userId: string,
  input: AiSettingsUpdateInput,
): Promise<EffectiveAiSettings> {
  const data = {
    preferredProvider: input.preferredProvider ?? null,
    openaiModel: cleanModel(input.openaiModel),
    anthropicModel: cleanModel(input.anthropicModel),
    geminiModel: cleanModel(input.geminiModel),
  }

  await prisma.userAiSetting.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  })

  return resolveUserAiSettings(userId)
}

// ── DTO для settings-роуту ──────────────────────────────────────────────

/** Доступність провайдера для користувача. */
export interface ProviderAvailability {
  /** Користувач додав власний ключ. */
  hasUserKey: boolean
  /** Налаштований сервісний (fallback) ключ на рівні сервера. */
  hasServiceKey: boolean
}

/** Стан безкоштовної квоти на сервісному ключі. */
export interface FreeQuotaStatus {
  limit: number
  used: number
  remaining: number
  periodStart: string
  resetAt: string
}

/** Повна відповідь для settings-сторінки (без секретів). */
export interface AiSettingsResponse {
  /** Сирий вибір користувача (для префілу форми; null → використовується база). */
  preferredProvider: AiProvider | null
  models: Record<AiProvider, string | null>
  /** Ефективні значення після накладання на env-базу. */
  effectiveModels: Record<AiProvider, string>
  /** Базовий провайдер із env (fallback, коли користувач не обрав свій). */
  defaultProvider: AiProvider | null
  providers: Record<AiProvider, ProviderAvailability>
  freeQuota: FreeQuotaStatus
}

/**
 * Збирає повний DTO налаштувань AI користувача:
 * сирі значення (для форми), ефективні моделі, доступність провайдерів та квоту.
 * Секрети (ключі) назовні не віддаються — лише прапорці наявності.
 */
export async function buildAiSettingsResponse(userId: string): Promise<AiSettingsResponse> {
  const [raw, userKeys, quota] = await Promise.all([
    prisma.userAiSetting.findUnique({ where: { userId } }),
    prisma.userAiKey.findMany({ where: { userId }, select: { provider: true } }),
    prisma.freeQuota.findUnique({ where: { userId } }),
  ])

  const userKeyProviders = new Set(userKeys.map((k) => k.provider))

  const providers = Object.fromEntries(
    ALL_PROVIDERS.map((p) => [
      p,
      { hasUserKey: userKeyProviders.has(p), hasServiceKey: serviceKey(p) !== null },
    ]),
  ) as Record<AiProvider, ProviderAvailability>

  const models: Record<AiProvider, string | null> = {
    OPENAI: cleanModel(raw?.openaiModel),
    ANTHROPIC: cleanModel(raw?.anthropicModel),
    GEMINI: cleanModel(raw?.geminiModel),
  }

  const effectiveModels: Record<AiProvider, string> = {
    OPENAI: models.OPENAI ?? DEFAULT_MODELS.OPENAI,
    ANTHROPIC: models.ANTHROPIC ?? DEFAULT_MODELS.ANTHROPIC,
    GEMINI: models.GEMINI ?? DEFAULT_MODELS.GEMINI,
  }

  const limit = freeQuotaLimit()
  const periodMs = freeQuotaPeriodMs()
  const now = Date.now()
  // Прострочений період вважається скинутим (used=0).
  const periodStartMs = quota ? quota.periodStart.getTime() : now
  const expired = now - periodStartMs >= periodMs
  const used = quota && !expired ? quota.usedCount : 0
  const effectivePeriodStart = expired ? now : periodStartMs

  return {
    preferredProvider: raw?.preferredProvider ?? null,
    models,
    effectiveModels,
    defaultProvider: defaultServiceProvider(),
    providers,
    freeQuota: {
      limit,
      used,
      remaining: Math.max(0, limit - used),
      periodStart: new Date(effectivePeriodStart).toISOString(),
      resetAt: new Date(effectivePeriodStart + periodMs).toISOString(),
    },
  }
}

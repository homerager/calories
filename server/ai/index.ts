import type { AiProvider, AiRequestKind } from '../../prisma/generated/client/enums'
import type { RecognitionResult } from './types'
import { createProvider } from './factory'
import { consumeFreeQuota, resolveAiKey } from './keyResolver'
import { logAiRequest } from './log'
import { resolveUserAiSettings } from './settings'

// Оркестратор AI-шару: резолв ключа → провайдер → виклик → лог → списання квоти.
// Роут (food/recognize) використовує ці функції; кеш-логіка (пошук у довіднику)
// лишається на рівні роуту й логується через logRecognitionCacheHit.

export interface RecognizeOptions {
  userId: string
  /**
   * Явне перевизначення провайдера для цього запиту (напр. з тіла запиту).
   * Якщо не задано — береться preferredProvider із налаштувань користувача,
   * інакше — базовий провайдер із env.
   */
  preferred?: AiProvider
  /**
   * Явне перевизначення моделі для цього запиту.
   * Якщо не задано — модель із налаштувань користувача, інакше — базова з env.
   */
  model?: string
}

export interface RecognizeResponse extends RecognitionResult {
  provider: AiProvider
  /** true → використано сервісний (fallback) ключ. */
  usingFallback: boolean
}

/** Розпізнавання за текстовим описом. */
export async function recognizeTextFood(
  description: string,
  options: RecognizeOptions,
): Promise<RecognizeResponse> {
  return runRecognition('TEXT', options, (p) => p.recognizeText(description))
}

/** Розпізнавання за фото (base64 без data-URL-префіксу). */
export async function recognizeImageFood(
  imageBase64: string,
  options: RecognizeOptions & { mimeType?: string },
): Promise<RecognizeResponse> {
  return runRecognition('IMAGE', options, (p) => p.recognizeImage(imageBase64, options.mimeType))
}

/** Спільний потік: ключ → провайдер → виклик → лог → квота. */
async function runRecognition(
  kind: AiRequestKind,
  options: RecognizeOptions,
  invoke: (provider: ReturnType<typeof createProvider>) => Promise<RecognitionResult>,
): Promise<RecognizeResponse> {
  // Персональні налаштування користувача (env — лише база).
  const settings = await resolveUserAiSettings(options.userId)

  // Пріоритет провайдера: явний запит → налаштування користувача → env-база (у keyResolver).
  const preferred = options.preferred ?? settings.preferredProvider ?? undefined
  const resolved = await resolveAiKey(options.userId, preferred)

  // Пріоритет моделі: явний запит → модель користувача для цього провайдера → env-база.
  const model = options.model ?? settings.models[resolved.provider]
  const provider = createProvider(resolved.provider, resolved.apiKey, { model })

  const result = await invoke(provider)

  await logAiRequest({
    userId: options.userId,
    provider: resolved.provider,
    model: result.model,
    kind,
    usage: result.usage,
    cacheHit: false,
  })

  // Списуємо безкоштовну квоту лише за успішного fallback-виклику.
  if (resolved.usingFallback) {
    await consumeFreeQuota(options.userId)
  }

  return { ...result, provider: resolved.provider, usingFallback: resolved.usingFallback }
}

/**
 * Логує влучання в кеш (результат узято з довідника, AI не викликали).
 * Викликається роутом, коли схожу страву знайдено у FoodItem.
 */
export async function logRecognitionCacheHit(params: {
  userId: string
  provider: AiProvider
  model: string
  kind: AiRequestKind
}): Promise<void> {
  await logAiRequest({ ...params, cacheHit: true })
}

// ── Публічний реекспорт AI-шару ──────────────────────────────────────────
export * from './types'
export { createProvider } from './factory'
export type { CreateProviderOptions } from './factory'
export {
  resolveAiKey,
  consumeFreeQuota,
  assertFreeQuota,
  providerPreferenceOrder,
  type ResolvedKey,
} from './keyResolver'
export { logAiRequest, type LogAiRequestParams } from './log'
export {
  AiProviderError,
  statusForAiError,
  friendlyAiMessage,
  classifyAiError,
  providerLabel,
  type AiErrorKind,
} from './providers/shared'
export {
  resolveUserAiSettings,
  upsertUserAiSettings,
  buildAiSettingsResponse,
  effectiveModel,
  aiProviderSchema,
  aiSettingsUpdateSchema,
  type EffectiveAiSettings,
  type AiSettingsUpdateInput,
  type AiSettingsResponse,
  type ProviderAvailability,
  type FreeQuotaStatus,
} from './settings'
export {
  listUserAiKeys,
  upsertUserAiKey,
  deleteUserAiKey,
  aiKeyUpsertSchema,
  type AiKeyInfo,
  type AiKeyUpsertInput,
} from './keys'
export {
  DEFAULT_MODELS,
  serviceKey,
  providersWithServiceKey,
  defaultServiceProvider,
  freeQuotaLimit,
  freeQuotaPeriodMs,
} from './config'

import { recognizeSchema } from '../../utils/foodSchemas'
import { prisma } from '../../utils/prisma'
import { normalizeFoodKey } from '../../utils/crypto'
import { roundKcal, roundMacro } from '../../utils/food'
import {
  AiProviderError,
  logRecognitionCacheHit,
  recognizeImageFood,
  recognizeTextFood,
  statusForAiError,
} from '../../ai'
import { resolveUserAiSettings } from '../../ai/settings'
import { defaultServiceProvider } from '../../ai/config'
import type { AiProvider } from '../../../prisma/generated/client/enums'

// Розпізнавання їжі: спершу кеш довідника (для тексту), інакше — AI-шар.
// Повертає ЧЕРНЕТКУ (нічого не зберігає) — користувач підтверджує через POST /api/meals.

/** Визначає провайдера/модель для логу cacheHit (best-effort, без виклику AI). */
async function resolveLogTarget(userId: string): Promise<{ provider: AiProvider; model: string } | null> {
  const settings = await resolveUserAiSettings(userId)
  const provider = settings.preferredProvider ?? defaultServiceProvider()
  if (!provider) return null
  return { provider, model: settings.models[provider] }
}

export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'food/recognize',
    key: user.id,
    limit: 20,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => recognizeSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректний запит розпізнавання',
    })
  }

  const data = body.data

  // 1) Кеш довідника (лише для тексту): точний збіг за нормалізованим ключем.
  if (data.kind === 'TEXT' && data.text) {
    const normalizedKey = normalizeFoodKey(data.text)
    const item = await prisma.foodItem.findUnique({ where: { normalizedKey } })
    if (item) {
      const target = await resolveLogTarget(user.id)
      if (target) {
        await logRecognitionCacheHit({
          userId: user.id,
          provider: target.provider,
          model: target.model,
          kind: 'TEXT',
        })
      }

      // Чернетка на базову порцію 100 г (значення довідника — на 100 г).
      return {
        cacheHit: true,
        provider: target?.provider ?? null,
        model: target?.model ?? null,
        usingFallback: false,
        draft: {
          name: item.name,
          portionGrams: 100,
          kcal: roundKcal(item.kcalPer100),
          protein: roundMacro(item.proteinPer100),
          fat: roundMacro(item.fatPer100),
          carb: roundMacro(item.carbPer100),
          confidence: 1,
          per100: {
            kcal: item.kcalPer100,
            protein: item.proteinPer100,
            fat: item.fatPer100,
            carb: item.carbPer100,
          },
          foodItemId: item.id,
          suggestedSource: 'MANUAL' as const,
        },
      }
    }
  }

  // 2) AI-шар (резолв ключа/провайдера/моделі, виклик, лог, квота — усередині).
  try {
    const result =
      data.kind === 'TEXT'
        ? await recognizeTextFood(data.text!, { userId: user.id, preferred: data.provider })
        : await recognizeImageFood(data.imageBase64!, {
            userId: user.id,
            preferred: data.provider,
            mimeType: data.mimeType,
          })

    const d = result.data
    return {
      cacheHit: false,
      provider: result.provider,
      model: result.model,
      usingFallback: result.usingFallback,
      draft: {
        name: d.name,
        portionGrams: d.portionGrams,
        kcal: roundKcal(d.kcal),
        protein: roundMacro(d.protein),
        fat: roundMacro(d.fat),
        carb: roundMacro(d.carb),
        confidence: d.confidence,
        per100: {
          kcal: roundMacro((d.kcal / d.portionGrams) * 100),
          protein: roundMacro((d.protein / d.portionGrams) * 100),
          fat: roundMacro((d.fat / d.portionGrams) * 100),
          carb: roundMacro((d.carb / d.portionGrams) * 100),
        },
        foodItemId: null,
        suggestedSource: data.kind === 'IMAGE' ? ('AI_PHOTO' as const) : ('AI_TEXT' as const),
      },
    }
  } catch (err) {
    if (err instanceof AiProviderError) {
      // Повна причина — у серверний лог; користувачу — дружнє повідомлення.
      console.error('[food/recognize] AI-провайдер:', err.provider, err.kind, err.message)
      throw createError({
        statusCode: statusForAiError(err.kind),
        statusMessage: 'AI Provider Error',
        message: err.userMessage,
        // Метадані для клієнта (напр. підказка перейти в налаштування).
        data: { aiErrorKind: err.kind, provider: err.provider },
      })
    }
    throw err
  }
})

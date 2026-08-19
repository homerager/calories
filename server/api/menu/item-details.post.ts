import { prisma } from '../../utils/prisma'
import { menuItemDetailsSchema } from '../../utils/menuSchemas'
import { AiProviderError, generateDishDetails, statusForAiError } from '../../ai'
import type { DishDetails } from '../../ai'
import type { Prisma } from '../../../prisma/generated/client/client'

// Деталі страви меню (інгредієнти/кроки/поради). Кешується у MenuItem.detailsJson:
// перший запит викликає AI, наступні повертають збережене без AI-виклику.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'menu/item-details',
    key: user.id,
    limit: 30,
    windowMs: 60_000,
  })

  const body = await readValidatedBody(event, (b) => menuItemDetailsSchema.safeParse(b))
  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: body.error.issues[0]?.message ?? 'Некоректний запит деталей',
    })
  }

  const item = await prisma.menuItem.findUnique({
    where: { id: body.data.itemId },
    select: {
      id: true,
      name: true,
      portionGrams: true,
      kcal: true,
      protein: true,
      fat: true,
      carb: true,
      detailsJson: true,
      plan: { select: { userId: true } },
    },
  })

  if (!item || item.plan.userId !== user.id) {
    throw createError({ statusCode: 404, statusMessage: 'Not Found', message: 'Страву не знайдено' })
  }

  // Кеш: якщо деталі вже згенеровані — повертаємо без AI.
  if (item.detailsJson) {
    return { details: item.detailsJson as unknown as DishDetails, cacheHit: true }
  }

  try {
    const result = await generateDishDetails({
      userId: user.id,
      preferred: body.data.provider,
      input: {
        name: item.name,
        portionGrams: item.portionGrams,
        kcal: item.kcal,
        protein: item.protein,
        fat: item.fat,
        carb: item.carb,
      },
    })

    await prisma.menuItem.update({
      where: { id: item.id },
      data: { detailsJson: result.data as unknown as Prisma.InputJsonValue },
    })

    return {
      details: result.data,
      cacheHit: false,
      provider: result.provider,
      model: result.model,
      usingFallback: result.usingFallback,
    }
  } catch (err) {
    if (err instanceof AiProviderError) {
      console.error('[menu/item-details] AI-провайдер:', err.provider, err.kind, err.message)
      throw createError({
        statusCode: statusForAiError(err.kind),
        statusMessage: 'AI Provider Error',
        message: err.userMessage,
        data: { aiErrorKind: err.kind, provider: err.provider },
      })
    }
    throw err
  }
})

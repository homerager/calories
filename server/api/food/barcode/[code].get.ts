import { getRouterParam } from 'h3'
import { fetchProductByBarcode, normalizeBarcode } from '../../../utils/openFoodFacts'

// Лукап продукту за штрихкодом (Open Food Facts) → ЧЕРНЕТКА у форматі /api/food/recognize.
// Нічого не зберігає: користувач підтверджує запис через POST /api/meals.
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  assertRateLimit(event, {
    prefix: 'food/barcode',
    key: user.id,
    limit: 30,
    windowMs: 60_000,
  })

  const barcode = normalizeBarcode(getRouterParam(event, 'code'))
  if (!barcode) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'Некоректний штрихкод',
    })
  }

  const product = await fetchProductByBarcode(barcode)
  if (!product) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Not Found',
      message: 'Продукт не знайдено в Open Food Facts або немає даних про калорійність',
    })
  }

  const { per100 } = product
  return {
    found: true,
    barcode,
    product: {
      name: product.name,
      brand: product.brand,
      imageUrl: product.imageUrl,
    },
    draft: {
      name: product.brand ? `${product.name} (${product.brand})` : product.name,
      // Порція завжди 100 г — користувач змінює, БЖВ масштабуються з per100.
      portionGrams: 100,
      kcal: per100.kcal,
      protein: per100.protein,
      fat: per100.fat,
      carb: per100.carb,
      confidence: 1,
      per100,
      foodItemId: null,
      suggestedSource: 'MANUAL' as const,
    },
  }
})

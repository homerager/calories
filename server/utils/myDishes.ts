import { prisma } from './prisma'

// Особиста база «Мої страви»: агрегація страв із історії MealEntry користувача.
// Джерело поживності на 100 г — довідник FoodItem; типова порція — з останнього запису.

export interface UserDish {
  foodItemId: string
  name: string
  per100: { kcal: number; protein: number; fat: number; carb: number }
  timesUsed: number
  lastUsedAt: string | null
  lastPortionGrams: number
}

/** Повертає найчастіші/найсвіжіші страви користувача (до `take` позицій). */
export async function getUserDishes(userId: string, take = 30): Promise<UserDish[]> {
  const grouped = await prisma.mealEntry.groupBy({
    by: ['foodItemId'],
    where: { userId, foodItemId: { not: null } },
    _count: { _all: true },
    _max: { date: true },
  })

  if (grouped.length === 0) return []

  const top = grouped
    .filter((g): g is typeof g & { foodItemId: string } => g.foodItemId != null)
    .sort((a, b) => {
      const byCount = (b._count._all ?? 0) - (a._count._all ?? 0)
      if (byCount !== 0) return byCount
      const aDate = a._max.date?.getTime() ?? 0
      const bDate = b._max.date?.getTime() ?? 0
      return bDate - aDate
    })
    .slice(0, take)

  const ids = top.map((g) => g.foodItemId)

  const foodItems = await prisma.foodItem.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      name: true,
      kcalPer100: true,
      proteinPer100: true,
      fatPer100: true,
      carbPer100: true,
    },
  })
  const byId = new Map(foodItems.map((f) => [f.id, f]))

  const latest = await prisma.mealEntry.findMany({
    where: { userId, foodItemId: { in: ids } },
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
    distinct: ['foodItemId'],
    select: { foodItemId: true, portionGrams: true },
  })
  const portionById = new Map(latest.map((e) => [e.foodItemId, e.portionGrams]))

  return top
    .map((g): UserDish | null => {
      const food = byId.get(g.foodItemId)
      if (!food) return null
      return {
        foodItemId: food.id,
        name: food.name,
        per100: {
          kcal: food.kcalPer100,
          protein: food.proteinPer100,
          fat: food.fatPer100,
          carb: food.carbPer100,
        },
        timesUsed: g._count._all ?? 0,
        lastUsedAt: g._max.date ? g._max.date.toISOString() : null,
        lastPortionGrams: portionById.get(g.foodItemId) ?? 100,
      }
    })
    .filter((x): x is UserDish => x !== null)
}

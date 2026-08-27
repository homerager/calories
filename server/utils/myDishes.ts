import { prisma } from './prisma'
import { dayKeyFromStored } from './day'

// Особиста база «Мої страви»: агрегація страв із історії MealEntry користувача.
// Джерело поживності на 100 г — довідник FoodItem; типова порція — з останнього запису.

export interface UserDish {
  foodItemId: string
  name: string
  per100: { kcal: number; protein: number; fat: number; carb: number }
  timesUsed: number
  lastUsedAt: string | null
  lastPortionGrams: number
  favorite: boolean
}

/** Випадкова вибірка n елементів (Fisher-Yates), без мутації вхідного масиву. */
export function pickRandom<T>(arr: T[], n: number): T[] {
  const copy = [...arr]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j]!, copy[i]!]
  }
  return copy.slice(0, n)
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

  const [foodItems, latest, favs] = await Promise.all([
    prisma.foodItem.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        kcalPer100: true,
        proteinPer100: true,
        fatPer100: true,
        carbPer100: true,
      },
    }),
    prisma.mealEntry.findMany({
      where: { userId, foodItemId: { in: ids } },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      distinct: ['foodItemId'],
      select: { foodItemId: true, portionGrams: true },
    }),
    prisma.foodFavorite.findMany({
      where: { userId, foodItemId: { in: ids } },
      select: { foodItemId: true },
    }),
  ])
  const byId = new Map(foodItems.map((f) => [f.id, f]))
  const portionById = new Map(latest.map((e) => [e.foodItemId, e.portionGrams]))
  const favSet = new Set(favs.map((f) => f.foodItemId))

  const dishes = top
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
        lastUsedAt: g._max.date ? dayKeyFromStored(g._max.date) : null,
        lastPortionGrams: portionById.get(g.foodItemId) ?? 100,
        favorite: favSet.has(food.id),
      }
    })
    .filter((x): x is UserDish => x !== null)

  dishes.sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.timesUsed - a.timesUsed)
  return dishes
}

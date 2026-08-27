import type { MealSource } from '../../prisma/generated/client/enums'
import { normalizeFoodKey } from './crypto'
import type { DbClient } from './aggregates'
import type { Per100 } from './food'

export function foodVisibilityWhere(userId: string) {
  return {
    OR: [{ ownerUserId: null }, { ownerUserId: userId }],
  }
}

/** Страва з глобального довідника або власна (не чужа). */
export async function findAccessibleFoodById(
  db: DbClient,
  userId: string,
  id: string,
): Promise<{ id: string } | null> {
  return db.foodItem.findFirst({
    where: { id, ...foodVisibilityWhere(userId) },
    select: { id: true },
  })
}

/** Глобальний збіг має пріоритет над особистою стравою з тим самим ключем. */
export async function findAccessibleFoodByKey(
  db: DbClient,
  userId: string,
  normalizedKey: string,
): Promise<{
  id: string
  name: string
  kcalPer100: number
  proteinPer100: number
  fatPer100: number
  carbPer100: number
} | null> {
  return db.foodItem.findFirst({
    where: { normalizedKey, ...foodVisibilityWhere(userId) },
    orderBy: { ownerUserId: { sort: 'asc', nulls: 'first' } },
    select: {
      id: true,
      name: true,
      kcalPer100: true,
      proteinPer100: true,
      fatPer100: true,
      carbPer100: true,
    },
  })
}

/** Мапа normalizedKey → id (глобальний збіг перекриває особистий). */
export async function mapAccessibleFoodsByKeys(
  db: DbClient,
  userId: string,
  keys: string[],
): Promise<Map<string, string>> {
  if (keys.length === 0) return new Map()
  const rows = await db.foodItem.findMany({
    where: { normalizedKey: { in: keys }, ...foodVisibilityWhere(userId) },
    select: { id: true, normalizedKey: true, ownerUserId: true },
    orderBy: { ownerUserId: { sort: 'asc', nulls: 'first' } },
  })
  const map = new Map<string, string>()
  for (const row of rows) {
    if (!map.has(row.normalizedKey)) map.set(row.normalizedKey, row.id)
  }
  return map
}

/**
 * Привʼязка запису щоденника до FoodItem: існуючий доступний id, інакше
 * глобальний/власний збіг за назвою, інакше нова приватна страва користувача.
 */
export async function resolveFoodItemForMeal(
  db: DbClient,
  userId: string,
  name: string,
  per100: Per100,
  source: MealSource,
  foodItemId?: string | null,
): Promise<string> {
  if (foodItemId) {
    const existing = await findAccessibleFoodById(db, userId, foodItemId)
    if (existing) return existing.id
  }

  const normalizedKey = normalizeFoodKey(name)
  const found = await findAccessibleFoodByKey(db, userId, normalizedKey)
  if (found) return found.id

  const created = await db.foodItem.create({
    data: {
      name,
      normalizedKey,
      ...per100,
      source: source === 'MANUAL' ? 'USER' : 'AI',
      ownerUserId: userId,
    },
    select: { id: true },
  })
  return created.id
}

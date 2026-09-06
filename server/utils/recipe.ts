import { Prisma } from '../../prisma/generated/client/client'
import type { MealSlot } from '../../prisma/generated/client/enums'
import { dishDetailsSchema, type DishDetails } from '../ai/types'
import { normalizeFoodKey } from './crypto'
import { roundKcal, roundMacro } from './food'
import type { DbClient } from './aggregates'

// Глобальний каталог страв (MenuDish) — ті самі поля, що в MenuItem, без плану.

export type RecipeDetails = DishDetails

export interface MenuDishInput {
  name: string
  slot?: MealSlot | null
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
  details?: RecipeDetails | null
  foodItemId?: string | null
  /** true → перезаписати detailsJson (явне збереження / PATCH). */
  overwriteDetails?: boolean
}

export interface RecipeRecord {
  id: string
  name: string
  slot: MealSlot | null
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
  detailsJson: Prisma.JsonValue | null
  foodItemId: string | null
  updatedAt: Date
}

export interface RecipeListItem {
  id: string
  name: string
  slot: MealSlot | null
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
  foodItemId: string | null
  hasRecipe: boolean
  updatedAt: string
}

export interface RecipeResponse extends RecipeListItem {
  details: RecipeDetails | null
}

const RECIPE_SELECT = {
  id: true,
  name: true,
  slot: true,
  portionGrams: true,
  kcal: true,
  protein: true,
  fat: true,
  carb: true,
  detailsJson: true,
  foodItemId: true,
  updatedAt: true,
} as const

export const menuDishSelect = RECIPE_SELECT

/** Парсить JSON рецепта; null, якщо структура невалідна. */
export function parseRecipeJson(value: unknown): RecipeDetails | null {
  const parsed = dishDetailsSchema.safeParse(value)
  return parsed.success ? parsed.data : null
}

export function toRecipeListItem(row: RecipeRecord): RecipeListItem {
  return {
    id: row.id,
    name: row.name,
    slot: row.slot,
    portionGrams: row.portionGrams,
    kcal: row.kcal,
    protein: row.protein,
    fat: row.fat,
    carb: row.carb,
    foodItemId: row.foodItemId,
    hasRecipe: parseRecipeJson(row.detailsJson) != null,
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toRecipeResponse(row: RecipeRecord): RecipeResponse {
  return { ...toRecipeListItem(row), details: parseRecipeJson(row.detailsJson) }
}

export async function findMenuDishById(db: DbClient, id: string): Promise<RecipeRecord | null> {
  return db.menuDish.findUnique({ where: { id }, select: RECIPE_SELECT })
}

export async function findMenuDishByName(db: DbClient, name: string): Promise<RecipeRecord | null> {
  const key = normalizeFoodKey(name)
  if (!key) return null
  return db.menuDish.findUnique({ where: { normalizedKey: key }, select: RECIPE_SELECT })
}

/**
 * Upsert у глобальний каталог за normalizedKey.
 * Нові страви створюються; наявні не перезаписують макроси.
 * Рецепт пишеться, якщо його ще немає, або якщо overwriteDetails.
 */
export async function upsertMenuDish(db: DbClient, input: MenuDishInput): Promise<RecipeRecord> {
  const name = input.name.trim()
  const key = normalizeFoodKey(name)
  if (!key) {
    throw new Error('Порожня назва страви')
  }

  const existing = await db.menuDish.findUnique({
    where: { normalizedKey: key },
    select: RECIPE_SELECT,
  })

  const detailsJson =
    input.details != null ? (input.details as unknown as Prisma.InputJsonValue) : undefined
  const hasNewDetails = detailsJson !== undefined

  if (existing) {
    const shouldWriteDetails =
      hasNewDetails && (input.overwriteDetails || !parseRecipeJson(existing.detailsJson))
    return db.menuDish.update({
      where: { id: existing.id },
      data: {
        ...(shouldWriteDetails ? { detailsJson } : {}),
        ...(existing.foodItemId || !input.foodItemId ? {} : { foodItemId: input.foodItemId }),
        ...(existing.slot || !input.slot ? {} : { slot: input.slot }),
      },
      select: RECIPE_SELECT,
    })
  }

  return db.menuDish.create({
    data: {
      name,
      normalizedKey: key,
      slot: input.slot ?? null,
      portionGrams: input.portionGrams > 0 ? input.portionGrams : 100,
      kcal: input.kcal,
      protein: input.protein,
      fat: input.fat,
      carb: input.carb,
      detailsJson: detailsJson ?? Prisma.DbNull,
      foodItemId: input.foodItemId ?? null,
    },
    select: RECIPE_SELECT,
  })
}

export async function upsertMenuDishes(db: DbClient, items: MenuDishInput[]): Promise<void> {
  for (const item of items) {
    await upsertMenuDish(db, item)
  }
}

/** Масштабує БЖВ з базової порції страви на фактичну. */
export function macrosForPortion(
  dish: { portionGrams: number; kcal: number; protein: number; fat: number; carb: number },
  portionGrams: number,
): { kcal: number; protein: number; fat: number; carb: number } {
  const base = dish.portionGrams > 0 ? dish.portionGrams : 100
  const factor = portionGrams / base
  return {
    kcal: roundKcal(dish.kcal * factor),
    protein: roundMacro(dish.protein * factor),
    fat: roundMacro(dish.fat * factor),
    carb: roundMacro(dish.carb * factor),
  }
}

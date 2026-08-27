import type { MealSlot } from '../../prisma/generated/client/enums'
import { dayKeyFromStored } from './day'

// Серіалізація збереженого меню (MenuPlan + MenuItem) у DTO для клієнта.

export interface MenuItemRecord {
  id: string
  dayIndex: number
  slot: MealSlot
  name: string
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
  foodItemId: string | null
}

export interface MenuPlanRecord {
  id: string
  startDate: Date
  createdAt: Date
  items: MenuItemRecord[]
}

export type MenuItemResponse = MenuItemRecord

export interface MenuPlanResponse {
  id: string
  startDate: string
  createdAt: string
  items: MenuItemResponse[]
}

export function toMenuPlanResponse(plan: MenuPlanRecord): MenuPlanResponse {
  return {
    id: plan.id,
    startDate: dayKeyFromStored(plan.startDate),
    createdAt: plan.createdAt.toISOString(),
    items: plan.items.map((it) => ({
      id: it.id,
      dayIndex: it.dayIndex,
      slot: it.slot,
      name: it.name,
      portionGrams: it.portionGrams,
      kcal: it.kcal,
      protein: it.protein,
      fat: it.fat,
      carb: it.carb,
      foodItemId: it.foodItemId,
    })),
  }
}

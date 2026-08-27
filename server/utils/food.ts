import type { MealSlot, MealSource } from '../../prisma/generated/client/enums'
import { dayKeyFromStored } from './day'

// Хелпери для їжі: перерахунок на 100 г, округлення та серіалізація MealEntry.

/** Округлення калорій до цілого. */
export function roundKcal(value: number): number {
  return Math.round(value)
}

/** Округлення макронутрієнтів до 1 знака. */
export function roundMacro(value: number): number {
  return Math.round(value * 10) / 10
}

/** Значення на 100 г із значення для порції. */
export function per100(value: number, portionGrams: number): number {
  if (portionGrams <= 0) return 0
  return roundMacro((value / portionGrams) * 100)
}

/** Поживність на 100 г (для upsert FoodItem). */
export interface Per100 {
  kcalPer100: number
  proteinPer100: number
  fatPer100: number
  carbPer100: number
}

/** Рахує поживність на 100 г із порційних значень. */
export function toPer100(input: {
  kcal: number
  protein: number
  fat: number
  carb: number
  portionGrams: number
}): Per100 {
  return {
    kcalPer100: per100(input.kcal, input.portionGrams),
    proteinPer100: per100(input.protein, input.portionGrams),
    fatPer100: per100(input.fat, input.portionGrams),
    carbPer100: per100(input.carb, input.portionGrams),
  }
}

/** Запис MealEntry із приєднаною назвою страви (з FoodItem). */
export interface MealEntryRecord {
  id: string
  date: Date
  slot: MealSlot | null
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
  source: MealSource
  confidence: number | null
  createdAt: Date
  foodItem: { name: string } | null
}

/** DTO запису прийому їжі для клієнта. */
export interface MealResponse {
  id: string
  date: string
  slot: MealSlot | null
  name: string
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
  source: MealSource
  confidence: number | null
  createdAt: string
}

/** Серіалізує MealEntry у DTO (назва береться з привʼязаного FoodItem). */
export function toMealResponse(entry: MealEntryRecord): MealResponse {
  return {
    id: entry.id,
    date: dayKeyFromStored(entry.date),
    slot: entry.slot,
    name: entry.foodItem?.name ?? '—',
    portionGrams: entry.portionGrams,
    kcal: entry.kcal,
    protein: entry.protein,
    fat: entry.fat,
    carb: entry.carb,
    source: entry.source,
    confidence: entry.confidence,
    createdAt: entry.createdAt.toISOString(),
  }
}

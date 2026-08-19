import { z } from 'zod'
import type { AiProvider, AiRequestKind } from '../../prisma/generated/client/enums'

// Єдиний контракт AI-шару: усі провайдери повертають строго типізований
// результат розпізнавання їжі, провалідований однією zod-схемою.

/**
 * Строгий результат розпізнавання страви.
 * Значення kcal/БЖВ — для всієї порції (portionGrams), а не на 100 г.
 */
export const foodRecognitionSchema = z.object({
  name: z.string().trim().min(1, 'Порожня назва страви').max(200, 'Задовга назва'),
  portionGrams: z.number().positive('Порція має бути > 0').max(5000, 'Нереалістична порція'),
  kcal: z.number().min(0).max(20000),
  protein: z.number().min(0).max(2000),
  fat: z.number().min(0).max(2000),
  carb: z.number().min(0).max(2000),
  // Впевненість моделі у розпізнаванні (0..1).
  confidence: z.number().min(0).max(1),
})

export type FoodRecognition = z.infer<typeof foodRecognitionSchema>

/** Витрати токенів на один AI-виклик (для логування/біллінгу). */
export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
}

/** Повний результат виклику провайдера: дані + метадані для логу. */
export interface RecognitionResult {
  /** Провалідований строгий JSON. */
  data: FoodRecognition
  /** Фактично використана модель (напр. 'gpt-4o-mini'). */
  model: string
  /** Витрати токенів (0, якщо провайдер їх не повернув). */
  usage: TokenUsage
}

// ── Меню на тиждень ────────────────────────────────────────────────────────

export const menuSlotSchema = z.enum(['BREAKFAST', 'LUNCH', 'DINNER', 'SNACK'])

/** Одна страва у меню (значення kcal/БЖВ — для всієї порції). */
export const menuMealSchema = z.object({
  slot: menuSlotSchema,
  name: z.string().trim().min(1, 'Порожня назва страви').max(200, 'Задовга назва'),
  portionGrams: z.number().positive('Порція має бути > 0').max(5000, 'Нереалістична порція'),
  kcal: z.number().min(0).max(20000),
  protein: z.number().min(0).max(2000),
  fat: z.number().min(0).max(2000),
  carb: z.number().min(0).max(2000),
})

/** Один день меню (dayIndex 0..6 від початку тижня). */
export const menuDaySchema = z.object({
  dayIndex: z.number().int().min(0).max(6),
  meals: z.array(menuMealSchema).min(1, 'Порожній день').max(8, 'Забагато страв за день'),
})

/** Строгий результат генерації меню на тиждень. */
export const menuPlanSchema = z.object({
  days: z.array(menuDaySchema).min(1, 'Порожнє меню').max(7, 'Більше 7 днів'),
})

/** Строгий результат генерації одного дня меню. */
export const menuDayResultSchema = z.object({
  meals: z.array(menuMealSchema).min(1, 'Порожній день').max(8, 'Забагато страв за день'),
})

// ── Деталі страви (інгредієнти / кроки / поради) ─────────────────────────────

export const dishIngredientSchema = z.object({
  name: z.string().trim().min(1, 'Порожній інгредієнт').max(200, 'Задовга назва'),
  // Приблизна кількість (може бути порожньою, якщо модель не вказала).
  amount: z.string().trim().max(100).default(''),
})

export const dishDetailsSchema = z.object({
  ingredients: z.array(dishIngredientSchema).min(1, 'Немає інгредієнтів').max(40),
  steps: z.array(z.string().trim().max(600)).max(30).default([]),
  tips: z.string().trim().max(600).default(''),
})

export type DishIngredient = z.infer<typeof dishIngredientSchema>
export type DishDetails = z.infer<typeof dishDetailsSchema>

export type MenuMeal = z.infer<typeof menuMealSchema>
export type MenuDay = z.infer<typeof menuDaySchema>
export type MenuPlanData = z.infer<typeof menuPlanSchema>
export type MenuDayData = z.infer<typeof menuDayResultSchema>

/** Поживність на 100 г для страви-кандидата. */
export interface MenuCandidateDish {
  name: string
  per100: { kcal: number; protein: number; fat: number; carb: number }
}

/** Цільові добові норми користувача (null → не задано). */
export interface MenuTargets {
  dailyKcal: number | null
  proteinGrams: number | null
  fatGrams: number | null
  carbGrams: number | null
  goal?: string | null
}

/** Вхід для генерації меню: норми + знайомі страви користувача. */
export interface MenuGenerationInput {
  targets: MenuTargets
  candidates: MenuCandidateDish[]
}

/** Вхід для генерації одного дня меню (перегенерація). */
export interface MenuDayGenerationInput {
  targets: MenuTargets
  candidates: MenuCandidateDish[]
  /** Назва дня для контексту (напр. «Понеділок»). */
  dayLabel?: string
  /** Назви страв з інших днів тижня — щоб уникнути повторів. */
  avoid?: string[]
}

/** Повний результат генерації меню: дані + метадані для логу. */
export interface MenuGenerationResult {
  data: MenuPlanData
  model: string
  usage: TokenUsage
}

/** Повний результат генерації одного дня: дані + метадані для логу. */
export interface MenuDayGenerationResult {
  data: MenuDayData
  model: string
  usage: TokenUsage
}

/** Вхід для генерації деталей страви (інгредієнти/кроки). */
export interface DishDetailsInput {
  name: string
  portionGrams: number
  kcal: number
  protein: number
  fat: number
  carb: number
}

/** Повний результат генерації деталей страви: дані + метадані для логу. */
export interface DishDetailsResult {
  data: DishDetails
  model: string
  usage: TokenUsage
}

/**
 * Спільний інтерфейс усіх AI-провайдерів.
 * Реалізації (OpenAI/Anthropic/Gemini) маплять строгу схему у свій формат
 * (structured output / tool schema) і повертають вже провалідований результат.
 */
export interface AIProvider {
  /** Провайдер (для логу та резолву ключа). */
  readonly provider: AiProvider
  /** Модель, яку використовує ця інстанція. */
  readonly model: string
  /** Розпізнавання за текстовим описом страви. */
  recognizeText(description: string): Promise<RecognitionResult>
  /** Розпізнавання за фото (base64 без data-URL-префіксу). */
  recognizeImage(imageBase64: string, mimeType?: string): Promise<RecognitionResult>
  /** Генерація меню на тиждень за нормами та знайомими стравами. */
  generateMenu(input: MenuGenerationInput): Promise<MenuGenerationResult>
  /** Перегенерація одного дня меню. */
  generateMenuDay(input: MenuDayGenerationInput): Promise<MenuDayGenerationResult>
  /** Деталі страви: інгредієнти, кроки приготування, поради. */
  generateDishDetails(input: DishDetailsInput): Promise<DishDetailsResult>
}

/** Порожні витрати токенів (fallback, коли провайдер їх не віддав). */
export const EMPTY_USAGE: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
}

export type { AiProvider, AiRequestKind }

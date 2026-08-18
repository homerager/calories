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
}

/** Порожні витрати токенів (fallback, коли провайдер їх не віддав). */
export const EMPTY_USAGE: TokenUsage = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
}

export type { AiProvider, AiRequestKind }

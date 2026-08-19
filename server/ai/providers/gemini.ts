import type {
  AIProvider,
  DishDetailsInput,
  DishDetailsResult,
  MenuDayGenerationInput,
  MenuDayGenerationResult,
  MenuGenerationInput,
  MenuGenerationResult,
  RecognitionResult,
  TokenUsage,
} from '../types'
import { EMPTY_USAGE } from '../types'
import { IMAGE_PROMPT, SYSTEM_PROMPT, textPrompt } from '../prompt'
import {
  DISH_DETAILS_GEMINI_SCHEMA,
  DISH_DETAILS_SYSTEM_PROMPT,
  MENU_DAY_GEMINI_SCHEMA,
  MENU_DAY_SYSTEM_PROMPT,
  MENU_GEMINI_SCHEMA,
  MENU_SYSTEM_PROMPT,
  dishDetailsUserPrompt,
  menuDayUserPrompt,
  menuUserPrompt,
} from '../menuPrompt'
import {
  AiProviderError,
  buildDishDetailsResult,
  buildMenuDayResult,
  buildMenuResult,
  buildResult,
  fetchWithRetry,
  normalizeMime,
  readJsonOrThrow,
  validateDishDetails,
  validateMenu,
  validateMenuDay,
  validateRecognition,
} from './shared'

// Google Gemini generateContent зі structured output:
// responseMimeType=application/json + responseSchema (підмножина OpenAPI).

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const PROVIDER = 'GEMINI' as const

// Gemini responseSchema не підтримує additionalProperties → окрема (без нього) схема.
const GEMINI_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    portionGrams: { type: 'number' },
    kcal: { type: 'number' },
    protein: { type: 'number' },
    fat: { type: 'number' },
    carb: { type: 'number' },
    confidence: { type: 'number' },
  },
  required: ['name', 'portionGrams', 'kcal', 'protein', 'fat', 'carb', 'confidence'],
} as const

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } }

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
  usageMetadata?: {
    promptTokenCount?: number
    candidatesTokenCount?: number
    totalTokenCount?: number
  }
}

function mapUsage(usage: GeminiResponse['usageMetadata']): TokenUsage {
  if (!usage) return { ...EMPTY_USAGE }
  const promptTokens = usage.promptTokenCount ?? 0
  const completionTokens = usage.candidatesTokenCount ?? 0
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage.totalTokenCount ?? promptTokens + completionTokens,
  }
}

export class GeminiProvider implements AIProvider {
  readonly provider = PROVIDER
  readonly model: string

  constructor(
    private readonly apiKey: string,
    model: string,
  ) {
    this.model = model
  }

  private async call(parts: GeminiPart[]): Promise<RecognitionResult> {
    const url = `${BASE}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: GEMINI_SCHEMA,
        },
      }),
    })

    const json = (await readJsonOrThrow(res, PROVIDER)) as GeminiResponse
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
    if (!text) {
      throw new AiProviderError('Gemini: порожня відповідь', PROVIDER)
    }
    const data = validateRecognition(text, PROVIDER)
    return buildResult(data, this.model, mapUsage(json.usageMetadata))
  }

  recognizeText(description: string): Promise<RecognitionResult> {
    return this.call([{ text: textPrompt(description) }])
  }

  recognizeImage(imageBase64: string, mimeType?: string): Promise<RecognitionResult> {
    return this.call([
      { text: IMAGE_PROMPT },
      { inlineData: { mimeType: normalizeMime(mimeType), data: imageBase64 } },
    ])
  }

  async generateMenu(input: MenuGenerationInput): Promise<MenuGenerationResult> {
    const url = `${BASE}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: MENU_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: menuUserPrompt(input) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: MENU_GEMINI_SCHEMA,
          maxOutputTokens: 8192,
        },
      }),
    })

    const json = (await readJsonOrThrow(res, PROVIDER)) as GeminiResponse
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
    if (!text) {
      throw new AiProviderError('Gemini: порожня відповідь', PROVIDER)
    }
    const data = validateMenu(text, PROVIDER)
    return buildMenuResult(data, this.model, mapUsage(json.usageMetadata))
  }

  async generateMenuDay(input: MenuDayGenerationInput): Promise<MenuDayGenerationResult> {
    const url = `${BASE}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: MENU_DAY_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: menuDayUserPrompt(input) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: MENU_DAY_GEMINI_SCHEMA,
          maxOutputTokens: 2048,
        },
      }),
    })

    const json = (await readJsonOrThrow(res, PROVIDER)) as GeminiResponse
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
    if (!text) {
      throw new AiProviderError('Gemini: порожня відповідь', PROVIDER)
    }
    const data = validateMenuDay(text, PROVIDER)
    return buildMenuDayResult(data, this.model, mapUsage(json.usageMetadata))
  }

  async generateDishDetails(input: DishDetailsInput): Promise<DishDetailsResult> {
    const url = `${BASE}/${encodeURIComponent(this.model)}:generateContent?key=${encodeURIComponent(this.apiKey)}`
    const res = await fetchWithRetry(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: DISH_DETAILS_SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: dishDetailsUserPrompt(input) }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: DISH_DETAILS_GEMINI_SCHEMA,
          maxOutputTokens: 2048,
        },
      }),
    })

    const json = (await readJsonOrThrow(res, PROVIDER)) as GeminiResponse
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('')
    if (!text) {
      throw new AiProviderError('Gemini: порожня відповідь', PROVIDER)
    }
    const data = validateDishDetails(text, PROVIDER)
    return buildDishDetailsResult(data, this.model, mapUsage(json.usageMetadata))
  }
}

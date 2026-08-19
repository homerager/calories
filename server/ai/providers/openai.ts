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
import { FOOD_JSON_SCHEMA, IMAGE_PROMPT, SCHEMA_NAME, SYSTEM_PROMPT, textPrompt } from '../prompt'
import {
  DISH_DETAILS_JSON_SCHEMA,
  DISH_DETAILS_SCHEMA_NAME,
  DISH_DETAILS_SYSTEM_PROMPT,
  MENU_DAY_JSON_SCHEMA,
  MENU_DAY_SCHEMA_NAME,
  MENU_DAY_SYSTEM_PROMPT,
  MENU_JSON_SCHEMA,
  MENU_SCHEMA_NAME,
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

// OpenAI Chat Completions зі структурованим виводом (response_format: json_schema).
// Використовуємо fetch напряму, без SDK, щоб не тягнути зайвих залежностей.

const ENDPOINT = 'https://api.openai.com/v1/chat/completions'
const PROVIDER = 'OPENAI' as const

type OpenAIMessageContent =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } }

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string | null } }>
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number }
}

function mapUsage(usage: OpenAIResponse['usage']): TokenUsage {
  if (!usage) return { ...EMPTY_USAGE }
  const promptTokens = usage.prompt_tokens ?? 0
  const completionTokens = usage.completion_tokens ?? 0
  return {
    promptTokens,
    completionTokens,
    totalTokens: usage.total_tokens ?? promptTokens + completionTokens,
  }
}

export class OpenAIProvider implements AIProvider {
  readonly provider = PROVIDER
  readonly model: string

  constructor(
    private readonly apiKey: string,
    model: string,
  ) {
    this.model = model
  }

  private async call(userContent: string | OpenAIMessageContent[]): Promise<RecognitionResult> {
    const res = await fetchWithRetry(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userContent },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: SCHEMA_NAME, schema: FOOD_JSON_SCHEMA, strict: true },
        },
      }),
    })

    const json = (await readJsonOrThrow(res, PROVIDER)) as OpenAIResponse
    const content = json.choices?.[0]?.message?.content
    if (!content) {
      throw new AiProviderError('OpenAI: порожня відповідь', PROVIDER)
    }
    const data = validateRecognition(content, PROVIDER)
    return buildResult(data, this.model, mapUsage(json.usage))
  }

  recognizeText(description: string): Promise<RecognitionResult> {
    return this.call(textPrompt(description))
  }

  recognizeImage(imageBase64: string, mimeType?: string): Promise<RecognitionResult> {
    const url = `data:${normalizeMime(mimeType)};base64,${imageBase64}`
    return this.call([
      { type: 'text', text: IMAGE_PROMPT },
      { type: 'image_url', image_url: { url } },
    ])
  }

  async generateMenu(input: MenuGenerationInput): Promise<MenuGenerationResult> {
    const res = await fetchWithRetry(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: MENU_SYSTEM_PROMPT },
          { role: 'user', content: menuUserPrompt(input) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: MENU_SCHEMA_NAME, schema: MENU_JSON_SCHEMA, strict: true },
        },
      }),
    })

    const json = (await readJsonOrThrow(res, PROVIDER)) as OpenAIResponse
    const content = json.choices?.[0]?.message?.content
    if (!content) {
      throw new AiProviderError('OpenAI: порожня відповідь', PROVIDER)
    }
    const data = validateMenu(content, PROVIDER)
    return buildMenuResult(data, this.model, mapUsage(json.usage))
  }

  async generateMenuDay(input: MenuDayGenerationInput): Promise<MenuDayGenerationResult> {
    const res = await fetchWithRetry(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: MENU_DAY_SYSTEM_PROMPT },
          { role: 'user', content: menuDayUserPrompt(input) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: MENU_DAY_SCHEMA_NAME, schema: MENU_DAY_JSON_SCHEMA, strict: true },
        },
      }),
    })

    const json = (await readJsonOrThrow(res, PROVIDER)) as OpenAIResponse
    const content = json.choices?.[0]?.message?.content
    if (!content) {
      throw new AiProviderError('OpenAI: порожня відповідь', PROVIDER)
    }
    const data = validateMenuDay(content, PROVIDER)
    return buildMenuDayResult(data, this.model, mapUsage(json.usage))
  }

  async generateDishDetails(input: DishDetailsInput): Promise<DishDetailsResult> {
    const res = await fetchWithRetry(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: DISH_DETAILS_SYSTEM_PROMPT },
          { role: 'user', content: dishDetailsUserPrompt(input) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: DISH_DETAILS_SCHEMA_NAME, schema: DISH_DETAILS_JSON_SCHEMA, strict: true },
        },
      }),
    })

    const json = (await readJsonOrThrow(res, PROVIDER)) as OpenAIResponse
    const content = json.choices?.[0]?.message?.content
    if (!content) {
      throw new AiProviderError('OpenAI: порожня відповідь', PROVIDER)
    }
    const data = validateDishDetails(content, PROVIDER)
    return buildDishDetailsResult(data, this.model, mapUsage(json.usage))
  }
}

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

// Anthropic Messages API. Строгий вивід досягаємо через tool use:
// оголошуємо інструмент зі схемою й примусово викликаємо його (tool_choice).

const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const API_VERSION = '2023-06-01'
const MAX_TOKENS = 1024
// Меню на тиждень — значно більший вивід (7 днів × кілька страв).
const MENU_MAX_TOKENS = 4096
const PROVIDER = 'ANTHROPIC' as const

type AnthropicContent =
  | { type: 'text'; text: string }
  | { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

interface AnthropicResponse {
  content?: Array<{ type: string; name?: string; input?: unknown; text?: string }>
  usage?: { input_tokens?: number; output_tokens?: number }
}

function mapUsage(usage: AnthropicResponse['usage']): TokenUsage {
  if (!usage) return { ...EMPTY_USAGE }
  const promptTokens = usage.input_tokens ?? 0
  const completionTokens = usage.output_tokens ?? 0
  return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens }
}

export class AnthropicProvider implements AIProvider {
  readonly provider = PROVIDER
  readonly model: string

  constructor(
    private readonly apiKey: string,
    model: string,
  ) {
    this.model = model
  }

  private async call(content: AnthropicContent[]): Promise<RecognitionResult> {
    const res = await fetchWithRetry(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: [
          {
            name: SCHEMA_NAME,
            description: 'Повертає оцінений склад страви у строгій схемі.',
            input_schema: FOOD_JSON_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: SCHEMA_NAME },
        messages: [{ role: 'user', content }],
      }),
    })

    const json = (await readJsonOrThrow(res, PROVIDER)) as AnthropicResponse
    const toolUse = json.content?.find((c) => c.type === 'tool_use' && c.name === SCHEMA_NAME)
    if (!toolUse?.input) {
      throw new AiProviderError('Anthropic: відсутній tool_use у відповіді', PROVIDER)
    }
    const data = validateRecognition(toolUse.input, PROVIDER)
    return buildResult(data, this.model, mapUsage(json.usage))
  }

  recognizeText(description: string): Promise<RecognitionResult> {
    return this.call([{ type: 'text', text: textPrompt(description) }])
  }

  recognizeImage(imageBase64: string, mimeType?: string): Promise<RecognitionResult> {
    return this.call([
      { type: 'text', text: IMAGE_PROMPT },
      {
        type: 'image',
        source: { type: 'base64', media_type: normalizeMime(mimeType), data: imageBase64 },
      },
    ])
  }

  async generateMenu(input: MenuGenerationInput): Promise<MenuGenerationResult> {
    const res = await fetchWithRetry(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: MENU_MAX_TOKENS,
        system: MENU_SYSTEM_PROMPT,
        tools: [
          {
            name: MENU_SCHEMA_NAME,
            description: 'Повертає меню на тиждень у строгій схемі.',
            input_schema: MENU_JSON_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: MENU_SCHEMA_NAME },
        messages: [{ role: 'user', content: [{ type: 'text', text: menuUserPrompt(input) }] }],
      }),
    })

    const json = (await readJsonOrThrow(res, PROVIDER)) as AnthropicResponse
    const toolUse = json.content?.find((c) => c.type === 'tool_use' && c.name === MENU_SCHEMA_NAME)
    if (!toolUse?.input) {
      throw new AiProviderError('Anthropic: відсутній tool_use у відповіді', PROVIDER)
    }
    const data = validateMenu(toolUse.input, PROVIDER)
    return buildMenuResult(data, this.model, mapUsage(json.usage))
  }

  async generateMenuDay(input: MenuDayGenerationInput): Promise<MenuDayGenerationResult> {
    const res = await fetchWithRetry(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: MENU_MAX_TOKENS,
        system: MENU_DAY_SYSTEM_PROMPT,
        tools: [
          {
            name: MENU_DAY_SCHEMA_NAME,
            description: 'Повертає меню на один день у строгій схемі.',
            input_schema: MENU_DAY_JSON_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: MENU_DAY_SCHEMA_NAME },
        messages: [{ role: 'user', content: [{ type: 'text', text: menuDayUserPrompt(input) }] }],
      }),
    })

    const json = (await readJsonOrThrow(res, PROVIDER)) as AnthropicResponse
    const toolUse = json.content?.find((c) => c.type === 'tool_use' && c.name === MENU_DAY_SCHEMA_NAME)
    if (!toolUse?.input) {
      throw new AiProviderError('Anthropic: відсутній tool_use у відповіді', PROVIDER)
    }
    const data = validateMenuDay(toolUse.input, PROVIDER)
    return buildMenuDayResult(data, this.model, mapUsage(json.usage))
  }

  async generateDishDetails(input: DishDetailsInput): Promise<DishDetailsResult> {
    const res = await fetchWithRetry(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': API_VERSION,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: MENU_MAX_TOKENS,
        system: DISH_DETAILS_SYSTEM_PROMPT,
        tools: [
          {
            name: DISH_DETAILS_SCHEMA_NAME,
            description: 'Повертає інгредієнти та спосіб приготування страви.',
            input_schema: DISH_DETAILS_JSON_SCHEMA,
          },
        ],
        tool_choice: { type: 'tool', name: DISH_DETAILS_SCHEMA_NAME },
        messages: [{ role: 'user', content: [{ type: 'text', text: dishDetailsUserPrompt(input) }] }],
      }),
    })

    const json = (await readJsonOrThrow(res, PROVIDER)) as AnthropicResponse
    const toolUse = json.content?.find((c) => c.type === 'tool_use' && c.name === DISH_DETAILS_SCHEMA_NAME)
    if (!toolUse?.input) {
      throw new AiProviderError('Anthropic: відсутній tool_use у відповіді', PROVIDER)
    }
    const data = validateDishDetails(toolUse.input, PROVIDER)
    return buildDishDetailsResult(data, this.model, mapUsage(json.usage))
  }
}

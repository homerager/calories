import type { AIProvider } from './types'
import type { AiProvider } from '../../prisma/generated/client/enums'
import { DEFAULT_MODELS } from './config'
import { OpenAIProvider } from './providers/openai'
import { AnthropicProvider } from './providers/anthropic'
import { GeminiProvider } from './providers/gemini'

// Фабрика: створює інстанцію потрібного AI-провайдера за enum + ключ (+ опц. модель).

export interface CreateProviderOptions {
  /** Перевизначення моделі; інакше — DEFAULT_MODELS[provider]. */
  model?: string
}

/**
 * Створює провайдера за AiProvider enum.
 * Ключ передається явно (резолвиться у keyResolver — власний або сервісний).
 */
export function createProvider(
  provider: AiProvider,
  apiKey: string,
  options: CreateProviderOptions = {},
): AIProvider {
  const model = options.model ?? DEFAULT_MODELS[provider]

  switch (provider) {
    case 'OPENAI':
      return new OpenAIProvider(apiKey, model)
    case 'ANTHROPIC':
      return new AnthropicProvider(apiKey, model)
    case 'GEMINI':
      return new GeminiProvider(apiKey, model)
    default: {
      const _exhaustive: never = provider
      throw new Error(`Невідомий AI-провайдер: ${String(_exhaustive)}`)
    }
  }
}

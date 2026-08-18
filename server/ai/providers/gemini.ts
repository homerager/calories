import type { AIProvider, RecognitionResult, TokenUsage } from '../types'
import { EMPTY_USAGE } from '../types'
import { IMAGE_PROMPT, SYSTEM_PROMPT, textPrompt } from '../prompt'
import {
  AiProviderError,
  buildResult,
  fetchWithRetry,
  normalizeMime,
  readJsonOrThrow,
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
}

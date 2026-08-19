import {
  foodRecognitionSchema,
  menuPlanSchema,
  type FoodRecognition,
  type MenuGenerationResult,
  type MenuPlanData,
  type RecognitionResult,
  type TokenUsage,
} from '../types'

// Спільні хелпери для провайдерів: обробка HTTP-помилок, класифікація помилок,
// парсинг та валідація JSON-відповіді єдиною zod-схемою.

/** Категорії помилок AI-провайдера (для дружніх повідомлень і статусів). */
export type AiErrorKind =
  | 'insufficient_credits' // немає коштів/квоти на акаунті провайдера
  | 'invalid_key' // невірний/недійсний ключ або немає доступу
  | 'model_not_found' // обрана модель недоступна/застаріла
  | 'rate_limited' // забагато запитів
  | 'overloaded' // сервіс тимчасово перевантажений
  | 'bad_request' // некоректний запит
  | 'unknown'

const PROVIDER_LABELS: Record<string, string> = {
  OPENAI: 'OpenAI',
  ANTHROPIC: 'Anthropic (Claude)',
  GEMINI: 'Google Gemini',
}

/** Людяна назва провайдера (fallback — сирий код). */
export function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider
}

/** Класифікує помилку провайдера за HTTP-статусом і текстом відповіді. */
export function classifyAiError(status: number | undefined, detail: string): AiErrorKind {
  const t = detail.toLowerCase()

  // Кошти/квота (перевіряємо першими — часто це 400 або 429).
  if (
    t.includes('credit balance is too low') ||
    t.includes('insufficient_quota') ||
    t.includes('exceeded your current quota') ||
    t.includes('plans & billing') ||
    t.includes('billing')
  ) {
    return 'insufficient_credits'
  }

  // Модель недоступна/застаріла (часто 404 від Gemini/OpenAI).
  if (
    status === 404 ||
    t.includes('is not found for api version') ||
    t.includes('not supported for generatecontent') ||
    t.includes('model not found') ||
    t.includes('does not exist') ||
    (t.includes('model') && t.includes('not_found'))
  ) {
    return 'model_not_found'
  }

  // Невірний ключ / немає доступу.
  if (
    status === 401 ||
    status === 403 ||
    t.includes('invalid api key') ||
    t.includes('incorrect api key') ||
    t.includes('api_key_invalid') ||
    t.includes('api key not valid') ||
    t.includes('authentication') ||
    t.includes('unauthorized') ||
    t.includes('permission_denied')
  ) {
    return 'invalid_key'
  }

  // Ліміт частоти.
  if (
    status === 429 ||
    t.includes('rate limit') ||
    t.includes('rate_limit') ||
    t.includes('resource_exhausted') ||
    t.includes('too many requests')
  ) {
    return 'rate_limited'
  }

  // Перевантаження.
  if (status === 529 || status === 503 || t.includes('overloaded')) {
    return 'overloaded'
  }

  if (status === 400) return 'bad_request'
  return 'unknown'
}

/** Дружнє (українською) повідомлення для користувача за категорією помилки. */
export function friendlyAiMessage(kind: AiErrorKind, provider: string): string {
  const label = providerLabel(provider)
  switch (kind) {
    case 'insufficient_credits':
      return `Недостатньо коштів на акаунті провайдера ${label}. Поповніть баланс або оберіть іншого провайдера в Налаштуваннях → AI.`
    case 'invalid_key':
      return `Невірний або недійсний API-ключ (${label}). Перевірте ключ у Налаштуваннях → AI.`
    case 'model_not_found':
      return `Обрана модель недоступна у провайдера ${label}. Змініть модель у Налаштуваннях → AI (порожнє поле = базова модель).`
    case 'rate_limited':
      return `Забагато запитів до ${label}. Зачекайте трохи й спробуйте ще раз.`
    case 'overloaded':
      return `Сервіс ${label} тимчасово перевантажений. Спробуйте ще раз за кілька секунд.`
    case 'bad_request':
      return `${label} відхилив запит. Спробуйте інший опис/фото або оберіть іншого провайдера в Налаштуваннях → AI.`
    default:
      return `Не вдалося отримати відповідь від ${label}. Спробуйте пізніше або оберіть іншого провайдера в Налаштуваннях → AI.`
  }
}

/** HTTP-статус відповіді нашого API за категорією помилки провайдера. */
export function statusForAiError(kind: AiErrorKind): number {
  switch (kind) {
    case 'insufficient_credits':
      return 402
    case 'invalid_key':
    case 'bad_request':
    case 'model_not_found':
      return 400
    case 'rate_limited':
      return 429
    case 'overloaded':
      return 503
    default:
      return 502
  }
}

/** Помилка виклику AI-провайдера із класифікацією та дружнім повідомленням. */
export class AiProviderError extends Error {
  readonly kind: AiErrorKind
  /** Дружнє повідомлення для показу користувачу. */
  readonly userMessage: string

  constructor(
    message: string,
    readonly provider: string,
    readonly status?: number,
    override readonly cause?: unknown,
    kind?: AiErrorKind,
  ) {
    super(message)
    this.name = 'AiProviderError'
    this.kind = kind ?? 'unknown'
    this.userMessage = friendlyAiMessage(this.kind, provider)
  }
}

// HTTP-статуси, які варто повторити (тимчасові збої: ліміт/перевантаження/5xx).
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 529])

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export interface RetryOptions {
  /** Кількість ДОДАТКОВИХ спроб після першої (усього спроб = retries + 1). */
  retries?: number
  /** Базова затримка для експоненційного відступу (мс). */
  baseDelayMs?: number
}

/**
 * fetch із повторами на тимчасові збої (429/5xx та мережеві помилки).
 * Експоненційний відступ із джитером. Нетимчасові відповіді повертаються одразу
 * (їх обробляє readJsonOrThrow), тому класифікація помилок не змінюється.
 */
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
  options: RetryOptions = {},
): Promise<Response> {
  const retries = options.retries ?? 2
  const base = options.baseDelayMs ?? 500

  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, init)
      if (res.ok || !RETRYABLE_STATUS.has(res.status) || attempt >= retries) {
        return res
      }
    } catch (err) {
      // Мережева помилка — повторюємо, доки не вичерпано спроби.
      if (attempt >= retries) throw err
    }
    // Експоненційний відступ + джитер, щоб не бити синхронно.
    await sleep(base * 2 ** attempt + Math.random() * base)
  }
}

/** Кидає AiProviderError, якщо відповідь не OK; повертає розпарсений JSON. */
export async function readJsonOrThrow(res: Response, provider: string): Promise<unknown> {
  if (!res.ok) {
    let detail: string
    try {
      detail = await res.text()
    } catch {
      detail = ''
    }
    const kind = classifyAiError(res.status, detail)
    throw new AiProviderError(
      `${provider} API помилка ${res.status}: ${detail.slice(0, 500)}`,
      provider,
      res.status,
      undefined,
      kind,
    )
  }
  try {
    return await res.json()
  } catch (err) {
    throw new AiProviderError(`${provider}: не вдалося розпарсити відповідь`, provider, res.status, err)
  }
}

/** Витягує перший JSON-обʼєкт із тексту (на випадок обгортки ```json ... ```). */
function coerceJson(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start !== -1 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1))
    }
    throw new SyntaxError('Не знайдено валідного JSON у відповіді')
  }
}

/**
 * Валідує довільний вхід (обʼєкт або рядок-JSON) строгою схемою розпізнавання.
 * Кидає AiProviderError, якщо структура не відповідає контракту.
 */
export function validateRecognition(raw: unknown, provider: string): FoodRecognition {
  const value = typeof raw === 'string' ? coerceJson(raw) : raw
  const parsed = foodRecognitionSchema.safeParse(value)
  if (!parsed.success) {
    throw new AiProviderError(
      `${provider}: відповідь не відповідає схемі — ${parsed.error.issues[0]?.message ?? 'invalid'}`,
      provider,
    )
  }
  return parsed.data
}

/** Збирає фінальний RecognitionResult. */
export function buildResult(data: FoodRecognition, model: string, usage: TokenUsage): RecognitionResult {
  return { data, model, usage }
}

/**
 * Валідує довільний вхід (обʼєкт або рядок-JSON) схемою меню на тиждень.
 * Кидає AiProviderError, якщо структура не відповідає контракту.
 */
export function validateMenu(raw: unknown, provider: string): MenuPlanData {
  const value = typeof raw === 'string' ? coerceJson(raw) : raw
  const parsed = menuPlanSchema.safeParse(value)
  if (!parsed.success) {
    throw new AiProviderError(
      `${provider}: меню не відповідає схемі — ${parsed.error.issues[0]?.message ?? 'invalid'}`,
      provider,
    )
  }
  return parsed.data
}

/** Збирає фінальний MenuGenerationResult. */
export function buildMenuResult(data: MenuPlanData, model: string, usage: TokenUsage): MenuGenerationResult {
  return { data, model, usage }
}

/** Нормалізує mime-тип зображення (дефолт image/jpeg). */
export function normalizeMime(mimeType?: string): string {
  const m = mimeType?.trim().toLowerCase()
  if (m && /^image\/(jpeg|jpg|png|webp|gif|heic|heif)$/.test(m)) {
    return m === 'image/jpg' ? 'image/jpeg' : m
  }
  return 'image/jpeg'
}

import { createError, getRequestIP, type H3Event } from 'h3'

// Просте in-memory обмеження частоти запитів (fixed-window лічильник).
// Достатньо для одного інстансу; за потреби легко замінити на Postgres/Redis-бекенд.

interface Bucket {
  count: number
  resetAt: number // epoch ms, коли вікно скидається
}

const buckets = new Map<string, Bucket>()

// Рідкісний прибиральник прострочених бакетів, щоб Map не ріс безмежно.
let lastSweep = 0
const SWEEP_INTERVAL_MS = 60_000

function sweep(now: number): void {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return
  lastSweep = now
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export interface RateLimitOptions {
  /** Максимум запитів у межах вікна. */
  limit: number
  /** Тривалість вікна у мілісекундах. */
  windowMs: number
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  resetAt: number // epoch ms
  retryAfterSec: number // 0, якщо не перевищено
}

/**
 * Реєструє звернення для ключа й повертає результат.
 * НЕ кидає помилок — зручно для м'якої обробки.
 */
export function rateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now()
  sweep(now)

  const existing = buckets.get(key)
  let bucket: Bucket

  if (!existing || existing.resetAt <= now) {
    bucket = { count: 0, resetAt: now + options.windowMs }
    buckets.set(key, bucket)
  } else {
    bucket = existing
  }

  bucket.count++

  const success = bucket.count <= options.limit
  const remaining = Math.max(0, options.limit - bucket.count)
  const retryAfterSec = success ? 0 : Math.ceil((bucket.resetAt - now) / 1000)

  return {
    success,
    limit: options.limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSec,
  }
}

/** Формує ключ на основі IP клієнта та префікса (напр. назви роуту). */
export function clientKey(event: H3Event, prefix: string): string {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  return `${prefix}:${ip}`
}

export interface AssertRateLimitOptions extends RateLimitOptions {
  /** Префікс ключа (напр. 'food/recognize'). */
  prefix: string
  /** Готовий ключ (напр. userId). Якщо не задано — використовується IP клієнта. */
  key?: string
}

/**
 * Перевіряє ліміт для запиту й кидає 429 (з Retry-After), якщо перевищено.
 * Виставляє заголовки RateLimit-* у відповідь.
 */
export function assertRateLimit(event: H3Event, options: AssertRateLimitOptions): RateLimitResult {
  const key = options.key
    ? `${options.prefix}:${options.key}`
    : clientKey(event, options.prefix)

  const result = rateLimit(key, { limit: options.limit, windowMs: options.windowMs })

  event.node.res.setHeader('RateLimit-Limit', String(result.limit))
  event.node.res.setHeader('RateLimit-Remaining', String(result.remaining))
  event.node.res.setHeader('RateLimit-Reset', String(Math.ceil((result.resetAt - Date.now()) / 1000)))

  if (!result.success) {
    event.node.res.setHeader('Retry-After', String(result.retryAfterSec))
    throw createError({
      statusCode: 429,
      statusMessage: 'Too Many Requests',
      message: 'Забагато запитів. Спробуйте пізніше.',
    })
  }

  return result
}

/** Скидає всі лічильники (для тестів). */
export function resetRateLimits(): void {
  buckets.clear()
  lastSweep = 0
}

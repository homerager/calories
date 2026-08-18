import { createError } from 'h3'
import type { AiProvider } from '../../prisma/generated/client/enums'
import { prisma } from '../utils/prisma'
import { decrypt } from '../utils/crypto'
import { defaultServiceProvider, freeQuotaLimit, freeQuotaPeriodMs, serviceKey } from './config'

// Резолвер ключа: спершу власний ключ користувача (decrypt), інакше —
// сервісний (fallback) ключ із перевіркою безкоштовної квоти (FreeQuota).

export interface ResolvedKey {
  provider: AiProvider
  apiKey: string
  /** true → використано сервісний ключ (обмежено квотою). */
  usingFallback: boolean
}

/** Порядок переваги провайдерів, коли конкретний не заданий. */
const PROVIDER_ORDER: AiProvider[] = ['OPENAI', 'ANTHROPIC', 'GEMINI']

/**
 * Резолвить ключ для запиту.
 * @param userId    ідентифікатор користувача
 * @param preferred бажаний провайдер (напр. з налаштувань UI); опційно
 *
 * Кидає 400, якщо AI взагалі не налаштовано (ні власного, ні сервісного ключа).
 * Для fallback лише ПЕРЕВІРЯЄ доступність квоти (не списує) — списання
 * робиться `consumeFreeQuota` після успішного виклику.
 */
export async function resolveAiKey(userId: string, preferred?: AiProvider): Promise<ResolvedKey> {
  const userKeys = await prisma.userAiKey.findMany({
    where: { userId },
    select: { provider: true, encryptedKey: true },
  })

  // 1) Власний ключ користувача (пріоритет — бажаний провайдер).
  if (userKeys.length > 0) {
    const ordered = [
      ...(preferred ? userKeys.filter((k) => k.provider === preferred) : []),
      ...userKeys.filter((k) => !preferred || k.provider !== preferred),
    ]
    for (const key of ordered) {
      try {
        const apiKey = decrypt(key.encryptedKey)
        if (apiKey) return { provider: key.provider, apiKey, usingFallback: false }
      } catch {
        // Пошкоджений/невалідний шифр — пробуємо наступний ключ.
      }
    }
  }

  // 2) Fallback на сервісний ключ.
  const provider =
    (preferred && serviceKey(preferred) ? preferred : null) ?? defaultServiceProvider()

  if (!provider) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'AI не налаштовано: додайте власний ключ у налаштуваннях.',
    })
  }

  const apiKey = serviceKey(provider)
  if (!apiKey) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request',
      message: 'AI не налаштовано: додайте власний ключ у налаштуваннях.',
    })
  }

  await assertFreeQuota(userId)
  return { provider, apiKey, usingFallback: true }
}

// Наводимо порядок провайдерів у стабільний вигляд (використовується у тестах/діагностиці).
export function providerPreferenceOrder(): AiProvider[] {
  return [...PROVIDER_ORDER]
}

/**
 * Перевіряє, що у користувача лишилась безкоштовна квота (без списання).
 * Кидає 402, якщо ліміт вичерпано у поточному періоді.
 */
export async function assertFreeQuota(userId: string): Promise<void> {
  const limit = freeQuotaLimit()
  const quota = await prisma.freeQuota.findUnique({ where: { userId } })
  if (!quota) return // ще жодного fallback-запиту — квота вільна

  if (isPeriodExpired(quota.periodStart)) return // період скинеться при списанні

  if (quota.usedCount >= limit) {
    throw quotaExceededError(quota.periodStart)
  }
}

/**
 * Атомарно списує одну одиницю безкоштовної квоти (з ротацією періоду).
 * Викликати ПІСЛЯ успішного fallback-виклику AI.
 * Кидає 402, якщо ліміт уже вичерпано.
 */
export async function consumeFreeQuota(userId: string): Promise<void> {
  const limit = freeQuotaLimit()

  await prisma.$transaction(async (tx) => {
    const quota = await tx.freeQuota.findUnique({ where: { userId } })
    const now = new Date()

    if (!quota) {
      await tx.freeQuota.create({ data: { userId, usedCount: 1, periodStart: now } })
      return
    }

    // Ротація періоду: якщо старий період минув — починаємо новий.
    if (isPeriodExpired(quota.periodStart)) {
      await tx.freeQuota.update({
        where: { userId },
        data: { usedCount: 1, periodStart: now },
      })
      return
    }

    if (quota.usedCount >= limit) {
      throw quotaExceededError(quota.periodStart)
    }

    await tx.freeQuota.update({
      where: { userId },
      data: { usedCount: { increment: 1 } },
    })
  })
}

/** Чи минув період квоти від periodStart. */
function isPeriodExpired(periodStart: Date): boolean {
  return Date.now() - periodStart.getTime() >= freeQuotaPeriodMs()
}

/** 402 Payment Required з підказкою, коли квота відновиться. */
function quotaExceededError(periodStart: Date) {
  const resetAt = new Date(periodStart.getTime() + freeQuotaPeriodMs())
  return createError({
    statusCode: 402,
    statusMessage: 'Payment Required',
    message: `Безкоштовний ліміт AI-запитів вичерпано. Додайте власний ключ або спробуйте після ${resetAt.toISOString()}.`,
  })
}

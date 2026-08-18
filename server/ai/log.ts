import type { AiProvider, AiRequestKind } from '../../prisma/generated/client/enums'
import { prisma } from '../utils/prisma'
import type { TokenUsage } from './types'
import { EMPTY_USAGE } from './types'

// Запис кожного AI-виклику у AiRequestsLog (токени, модель, cacheHit).

export interface LogAiRequestParams {
  userId: string
  provider: AiProvider
  model: string
  kind: AiRequestKind
  usage?: TokenUsage
  /** true → результат взято з кешу довідника (AI не викликали). */
  cacheHit?: boolean
}

/**
 * Пише рядок у AiRequestsLog. Логування не має ламати основний потік —
 * помилки лише попереджаються у консоль, назовні не кидаються.
 */
export async function logAiRequest(params: LogAiRequestParams): Promise<void> {
  const usage = params.usage ?? EMPTY_USAGE
  try {
    await prisma.aiRequestsLog.create({
      data: {
        userId: params.userId,
        provider: params.provider,
        model: params.model,
        kind: params.kind,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        cacheHit: params.cacheHit ?? false,
      },
    })
  } catch (err) {
    console.error('[ai] Не вдалося записати AiRequestsLog:', err)
  }
}

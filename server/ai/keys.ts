import { z } from 'zod'
import type { AiProvider } from '../../prisma/generated/client/enums'
import { prisma } from '../utils/prisma'
import { decrypt, encrypt } from '../utils/crypto'
import { aiProviderSchema } from './settings'

// Керування власними AI-ключами користувача. Ключі шифруються at rest
// (AES-256-GCM у crypto.ts) і НІКОЛИ не віддаються клієнту у відкритому вигляді —
// лише замаскований прев'ю (останні 4 символи).

/** Додавання/оновлення ключа для провайдера. */
export const aiKeyUpsertSchema = z.object({
  provider: aiProviderSchema,
  apiKey: z
    .string()
    .trim()
    .min(20, 'Ключ виглядає надто коротким')
    .max(400, 'Задовгий ключ'),
})

export type AiKeyUpsertInput = z.infer<typeof aiKeyUpsertSchema>

/** Метадані ключа для клієнта (без секрету). */
export interface AiKeyInfo {
  provider: AiProvider
  /** Маскований прев'ю виду `••••abcd`. */
  maskedKey: string
  createdAt: string
  updatedAt: string
}

/** Маскує ключ, лишаючи видимими лише останні 4 символи. */
function maskKey(key: string): string {
  const tail = key.length >= 4 ? key.slice(-4) : key
  return `••••${tail}`
}

/** Список ключів користувача з масками (по одному на провайдера). */
export async function listUserAiKeys(userId: string): Promise<AiKeyInfo[]> {
  const keys = await prisma.userAiKey.findMany({
    where: { userId },
    orderBy: { provider: 'asc' },
  })

  return keys.map((k) => {
    let maskedKey = '••••'
    try {
      maskedKey = maskKey(decrypt(k.encryptedKey))
    } catch {
      // Пошкоджений шифр — показуємо лише плейсхолдер.
    }
    return {
      provider: k.provider,
      maskedKey,
      createdAt: k.createdAt.toISOString(),
      updatedAt: k.updatedAt.toISOString(),
    }
  })
}

/** Додає або оновлює ключ провайдера (шифрує перед збереженням). */
export async function upsertUserAiKey(
  userId: string,
  input: AiKeyUpsertInput,
): Promise<AiKeyInfo[]> {
  const encryptedKey = encrypt(input.apiKey)

  await prisma.userAiKey.upsert({
    where: { userId_provider: { userId, provider: input.provider } },
    update: { encryptedKey },
    create: { userId, provider: input.provider, encryptedKey },
  })

  return listUserAiKeys(userId)
}

/** Видаляє ключ провайдера (idempotent). */
export async function deleteUserAiKey(userId: string, provider: AiProvider): Promise<AiKeyInfo[]> {
  await prisma.userAiKey.deleteMany({ where: { userId, provider } })
  return listUserAiKeys(userId)
}

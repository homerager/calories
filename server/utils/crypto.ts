import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'

// Шифрування чутливих даних at rest (AES-256-GCM).
// Ключ береться з ENCRYPTION_KEY (32 байти у hex → 64 hex-символи).
// Формат зашифрованого рядка: `iv:tag:ciphertext` (усе у hex).

const ALGORITHM = 'aes-256-gcm'
const KEY_BYTES = 32 // AES-256
const IV_BYTES = 12 // рекомендований розмір nonce для GCM
const TAG_BYTES = 16 // довжина auth-тега GCM

let cachedKey: Buffer | null = null

/** Лениво резолвить і кешує 32-байтовий ключ із ENCRYPTION_KEY (hex). */
function getKey(): Buffer {
  if (cachedKey) return cachedKey

  const raw = process.env.ENCRYPTION_KEY
  if (!raw) {
    throw new Error('ENCRYPTION_KEY is not set')
  }
  if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
    throw new Error('ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters')
  }

  const key = Buffer.from(raw, 'hex')
  if (key.length !== KEY_BYTES) {
    throw new Error('ENCRYPTION_KEY must decode to exactly 32 bytes')
  }

  cachedKey = key
  return key
}

/**
 * Шифрує рядок у форматі `iv:tag:ciphertext` (hex).
 * Кожен виклик використовує свіжий випадковий IV.
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  return [iv.toString('hex'), tag.toString('hex'), ciphertext.toString('hex')].join(':')
}

/**
 * Розшифровує рядок формату `iv:tag:ciphertext` (hex).
 * Кидає помилку, якщо формат/тег невалідні (порушення цілісності).
 */
export function decrypt(payload: string): string {
  const key = getKey()
  const parts = payload.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format (expected iv:tag:ciphertext)')
  }

  const [ivHex, tagHex, dataHex] = parts as [string, string, string]
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const ciphertext = Buffer.from(dataHex, 'hex')

  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('Invalid encrypted payload (bad iv/tag length)')
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}

/**
 * Безпечне (за часом) порівняння рядків.
 * Корисно для порівняння токенів/хешів без витоку через тайминг.
 */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

/** Нормалізує назву у ключ пошуку схожих (lower, без пунктуації, згортання пробілів). */
export function normalizeFoodKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[’'`.,;:!?()"]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// Стиснення фото на клієнті перед відправкою на AI-розпізнавання.
// Зменшує до maxSize по більшій стороні та кодує у JPEG заданої якості.

export interface CompressedImage {
  /** base64 без data-URL-префіксу. */
  base64: string
  mimeType: string
}

/**
 * Стискає зображення до ~maxSize px (по більшій стороні) і JPEG q~quality.
 * Працює лише у браузері (використовує canvas). Кидає помилку в іншому середовищі.
 */
export async function compressImage(
  file: File,
  maxSize = 1024,
  quality = 0.7,
): Promise<CompressedImage> {
  if (typeof document === 'undefined') {
    throw new Error('Стиснення зображення доступне лише у браузері')
  }

  const bitmap = await createImageBitmap(file)
  try {
    const largest = Math.max(bitmap.width, bitmap.height)
    const scale = largest > maxSize ? maxSize / largest : 1
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Canvas 2D-контекст недоступний')
    }
    ctx.drawImage(bitmap, 0, 0, width, height)

    const dataUrl = canvas.toDataURL('image/jpeg', quality)
    const base64 = dataUrl.split(',')[1] ?? ''
    return { base64, mimeType: 'image/jpeg' }
  } finally {
    bitmap.close()
  }
}

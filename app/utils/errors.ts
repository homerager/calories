// Витягує людиночитабельне повідомлення з помилки $fetch (H3/FetchError).
export function extractErrorMessage(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null

  // $fetch кидає FetchError із полем `data` (тіло відповіді сервера).
  const data = (err as { data?: unknown }).data
  if (data && typeof data === 'object') {
    const message = (data as { message?: unknown; statusMessage?: unknown }).message
    if (typeof message === 'string' && message.length > 0) return message
    const statusMessage = (data as { statusMessage?: unknown }).statusMessage
    if (typeof statusMessage === 'string' && statusMessage.length > 0) return statusMessage
  }

  const message = (err as { message?: unknown }).message
  if (typeof message === 'string' && message.length > 0) return message

  return null
}

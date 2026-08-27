// Календарні дати на клієнті: локальна доба браузера, арифметика через UTC-полудень.

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** Сьогоднішній YYYY-MM-DD у локальній зоні браузера. */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

/** Зсув календарного YYYY-MM-DD на delta днів (без DST-сюрпризів). */
export function shiftIso(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T12:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

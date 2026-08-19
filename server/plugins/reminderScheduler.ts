import { dispatchDueReminders } from '../utils/reminderDispatch'

// Внутрішній планувальник нагадувань: щохвилини перевіряє, чи не настав час
// спрацювання, і розсилає сповіщення (in-app + Web Push). Проєкт живе одним
// pm2-процесом без окремого воркера/крону, тож просто крутимо setInterval.
export default defineNitroPlugin(() => {
  const tick = () => {
    dispatchDueReminders().catch((err) => console.error('[reminders] розсилка не вдалася', err))
  }

  tick()
  setInterval(tick, 60_000)
})

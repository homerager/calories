import { defineComponent, reactive, ref } from 'vue'
import {
  useReminders,
  REMINDER_KINDS,
  REMINDER_KIND_LABELS,
  WEEKDAY_LABELS,
  type ReminderItem,
  type ReminderKind,
} from '~/composables/useReminders'
import { usePushSubscription } from '~/composables/usePushSubscription'

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200'
const labelClass = 'block text-sm font-medium text-gray-700'

function formatDaysOfWeek(days: number[]): string {
  if (days.length === 0) return 'Щодня'
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => WEEKDAY_LABELS[d])
    .join(', ')
}

interface ReminderForm {
  kind: ReminderKind
  message: string
  timeOfDay: string
  daysOfWeek: number[]
  enabled: boolean
}

function emptyForm(): ReminderForm {
  return { kind: 'CUSTOM', message: '', timeOfDay: '09:00', daysOfWeek: [], enabled: true }
}

export default defineComponent({
  name: 'RemindersSettingsPage',
  setup() {
    definePageMeta({ middleware: 'auth' })

    const { reminders, pending, addReminder, updateReminder, deleteReminder } = useReminders()
    const push = usePushSubscription()

    const form = reactive<ReminderForm>(emptyForm())
    const editingId = ref<string | null>(null)
    const saving = ref(false)
    const formError = ref<string | null>(null)
    const busyId = ref<string | null>(null)

    function startEdit(reminder: ReminderItem) {
      editingId.value = reminder.id
      form.kind = reminder.kind
      form.message = reminder.message ?? ''
      form.timeOfDay = reminder.timeOfDay
      form.daysOfWeek = [...reminder.daysOfWeek]
      form.enabled = reminder.enabled
      formError.value = null
    }

    function cancelEdit() {
      editingId.value = null
      Object.assign(form, emptyForm())
      formError.value = null
    }

    function toggleDay(day: number) {
      const idx = form.daysOfWeek.indexOf(day)
      if (idx === -1) form.daysOfWeek.push(day)
      else form.daysOfWeek.splice(idx, 1)
    }

    async function onSubmit(e: Event) {
      e.preventDefault()
      formError.value = null
      saving.value = true
      try {
        const payload = {
          kind: form.kind,
          message: form.message.trim() || null,
          timeOfDay: form.timeOfDay,
          daysOfWeek: form.daysOfWeek,
          enabled: form.enabled,
        }
        if (editingId.value) {
          await updateReminder(editingId.value, payload)
        } else {
          await addReminder(payload)
        }
        cancelEdit()
      } catch (err: unknown) {
        formError.value = extractErrorMessage(err) ?? 'Не вдалося зберегти нагадування'
      } finally {
        saving.value = false
      }
    }

    async function onToggleEnabled(reminder: ReminderItem) {
      busyId.value = reminder.id
      try {
        await updateReminder(reminder.id, { enabled: !reminder.enabled })
      } finally {
        busyId.value = null
      }
    }

    async function onDelete(id: string) {
      busyId.value = id
      try {
        await deleteReminder(id)
        if (editingId.value === id) cancelEdit()
      } finally {
        busyId.value = null
      }
    }

    return () => (
      <section class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Нагадування</h1>
          <p class="mt-1 text-sm text-gray-500">
            Налаштуйте, коли додаток має нагадувати про їжу, воду, зважування чи інше.
          </p>
        </div>

        {/* Push-сповіщення */}
        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <h2 class="text-lg font-semibold text-gray-900">Push-сповіщення</h2>
          <p class="mt-1 text-sm text-gray-500">
            Дозвольте браузерні сповіщення, щоб отримувати нагадування навіть коли додаток закрито.
          </p>

          {push.error.value && (
            <div class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
              {push.error.value}
            </div>
          )}

          <div class="mt-4 flex items-center justify-between gap-3">
            {push.supported.value ? (
              <>
                <span class="text-sm text-gray-600">
                  {push.subscribed.value ? 'Push-сповіщення увімкнено на цьому пристрої' : 'Push-сповіщення вимкнено'}
                </span>
                <button
                  type="button"
                  onClick={() => (push.subscribed.value ? push.unsubscribe() : push.subscribe())}
                  disabled={push.busy.value}
                  class="shrink-0 rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {push.busy.value ? 'Зачекайте…' : push.subscribed.value ? 'Вимкнути' : 'Увімкнути'}
                </button>
              </>
            ) : (
              <span class="text-sm text-gray-500">Цей браузер не підтримує push-сповіщення.</span>
            )}
          </div>
        </div>

        {/* Форма додавання/редагування */}
        <form class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100" onSubmit={onSubmit}>
          <h2 class="text-lg font-semibold text-gray-900">
            {editingId.value ? 'Редагувати нагадування' : 'Нове нагадування'}
          </h2>

          {formError.value && (
            <div class="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
              {formError.value}
            </div>
          )}

          <div class="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label class={labelClass} for="reminder-kind">
                Тип
              </label>
              <select
                id="reminder-kind"
                value={form.kind}
                onChange={(e) => (form.kind = (e.target as HTMLSelectElement).value as ReminderKind)}
                class={inputClass}
              >
                {REMINDER_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {REMINDER_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label class={labelClass} for="reminder-time">
                Час
              </label>
              <input
                id="reminder-time"
                type="time"
                value={form.timeOfDay}
                onInput={(e) => (form.timeOfDay = (e.target as HTMLInputElement).value)}
                class={inputClass}
                required
              />
            </div>
          </div>

          <div class="mt-4">
            <label class={labelClass} for="reminder-message">
              Текст (опційно)
            </label>
            <input
              id="reminder-message"
              type="text"
              value={form.message}
              onInput={(e) => (form.message = (e.target as HTMLInputElement).value)}
              class={inputClass}
              placeholder={REMINDER_KIND_LABELS[form.kind]}
              maxlength={200}
            />
          </div>

          <div class="mt-4">
            <span class={labelClass}>Дні тижня</span>
            <div class="mt-1 flex flex-wrap gap-2">
              {WEEKDAY_LABELS.map((label, day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => toggleDay(day)}
                  class={
                    'rounded-full px-3 py-1 text-sm font-medium transition ' +
                    (form.daysOfWeek.includes(day)
                      ? 'bg-brand-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200')
                  }
                >
                  {label}
                </button>
              ))}
            </div>
            <p class="mt-1 text-xs text-gray-500">Нічого не обрано — нагадування спрацьовує щодня.</p>
          </div>

          <label class="mt-4 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => (form.enabled = (e.target as HTMLInputElement).checked)}
              class="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-200"
            />
            Увімкнено
          </label>

          <div class="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={saving.value}
              class="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving.value ? 'Зберігаємо…' : editingId.value ? 'Зберегти зміни' : 'Додати нагадування'}
            </button>
            {editingId.value && (
              <button
                type="button"
                onClick={cancelEdit}
                class="rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Скасувати
              </button>
            )}
          </div>
        </form>

        {/* Список нагадувань */}
        <div class="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-100">
          <h2 class="text-lg font-semibold text-gray-900">Ваші нагадування</h2>

          {pending.value ? (
            <p class="mt-4 text-sm text-gray-500">Завантаження…</p>
          ) : reminders.value.length === 0 ? (
            <p class="mt-4 text-sm text-gray-500">Ще немає жодного нагадування.</p>
          ) : (
            <ul class="mt-4 space-y-3">
              {reminders.value.map((r) => (
                <li
                  key={r.id}
                  class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-200 p-4"
                >
                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-medium text-gray-900">{r.timeOfDay}</span>
                      <span class="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                        {REMINDER_KIND_LABELS[r.kind]}
                      </span>
                      {!r.enabled && (
                        <span class="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                          Вимкнено
                        </span>
                      )}
                    </div>
                    {r.message && <p class="mt-1 truncate text-sm text-gray-600">{r.message}</p>}
                    <p class="mt-1 text-xs text-gray-500">{formatDaysOfWeek(r.daysOfWeek)}</p>
                  </div>

                  <div class="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onToggleEnabled(r)}
                      disabled={busyId.value === r.id}
                      class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {r.enabled ? 'Вимкнути' : 'Увімкнути'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startEdit(r)}
                      class="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                    >
                      Редагувати
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(r.id)}
                      disabled={busyId.value === r.id}
                      class="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Видалити
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    )
  },
})

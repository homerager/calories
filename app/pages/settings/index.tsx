import { defineComponent } from 'vue'
import { NuxtLink } from '#components'

interface SettingsCard {
  to: string
  title: string
  description: string
  icon: string
}

const cards: SettingsCard[] = [
  {
    to: '/profile',
    title: 'Профіль',
    description: 'Особисті дані, ціль і денні норми БЖВ.',
    icon: 'M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm0 2c-4.4 0-8 2.2-8 5v1h16v-1c0-2.8-3.6-5-8-5Z',
  },
  {
    to: '/settings/reminders',
    title: 'Нагадування',
    description: 'Час і дні нагадувань про їжу, воду, зважування; push-сповіщення.',
    icon: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9ZM13.73 21a2 2 0 0 1-3.46 0',
  },
  {
    to: '/settings/ai-keys',
    title: 'AI ключі',
    description: 'Провайдер і моделі для розпізнавання їжі, власні API-ключі.',
    icon: 'M12 2 2 7l10 5 10-5-10-5ZM2 17l10 5 10-5M2 12l10 5 10-5',
  },
  {
    to: '/settings/account',
    title: 'Акаунт',
    description: 'Зміна пароля та видалення всіх даних.',
    icon: 'M12 15v2m-6 4h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2Zm6-10V7a4 4 0 0 0-8 0',
  },
  {
    to: '/privacy',
    title: 'Privacy',
    description: 'Які дані збираємо, як зберігаємо і як їх видалити.',
    icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z',
  },
]

export default defineComponent({
  name: 'SettingsIndexPage',
  setup() {
    definePageMeta({ middleware: 'auth' })

    return () => (
      <section class="space-y-6">
        <div>
          <h1 class="text-2xl font-bold text-gray-900">Налаштування</h1>
          <p class="mt-1 text-sm text-gray-500">Профіль, нагадування та AI — усе в одному місці.</p>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {cards.map((card) => (
            <NuxtLink
              key={card.to}
              to={card.to}
              class="flex items-start gap-4 rounded-xl bg-card md:p-6 p-5 shadow-card ring-1 ring-transparent transition hover:ring-brand-300 focus:outline-none focus:ring-2 focus:ring-brand-400"
            >
              <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d={card.icon} />
                </svg>
              </span>
              <span class="min-w-0">
                <span class="block font-semibold text-gray-900">{card.title}</span>
                <span class="mt-1 block text-sm text-gray-500">{card.description}</span>
              </span>
            </NuxtLink>
          ))}
        </div>
      </section>
    )
  },
})

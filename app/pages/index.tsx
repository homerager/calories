import { defineComponent } from 'vue'

export default defineComponent({
  name: 'IndexPage',
  setup() {
    return () => (
      <section class="space-y-6">
        <div class="rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-100">
          <h1 class="text-2xl font-bold text-gray-900">
            Вітаємо у застосунку для підрахунку калорій
          </h1>
          <p class="mt-2 text-gray-600">
            Розпізнавайте їжу за фото чи описом, ведіть щоденник і слідкуйте за нормами БЖВ.
          </p>
        </div>

        <div class="rounded-xl border border-brand-100 bg-brand-50 p-4 text-sm text-brand-800">
          Каркас проєкту готовий: Nuxt 4 · Vue 3 · TSX · TypeScript · Tailwind CSS.
        </div>
      </section>
    )
  },
})

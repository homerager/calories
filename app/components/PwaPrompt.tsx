import { defineComponent, onMounted, ref, watch } from 'vue'
import { btnPrimaryClass, btnSecondaryClass } from '~/utils/ui'
import { useToast } from '~/composables/useToast'

export default defineComponent({
  name: 'PwaPrompt',
  setup() {
    const { $pwa } = useNuxtApp()
    const toast = useToast()
    const mounted = ref(false)

    onMounted(() => {
      mounted.value = true
      if (!$pwa) return
      watch(
        () => $pwa.offlineReady,
        (ready, wasReady) => {
          if (ready && !wasReady) toast.info('Додаток готовий до роботи офлайн')
        },
      )
    })

    return () => {
      if (!mounted.value || !$pwa) return null

      if ($pwa.needRefresh) {
        return (
          <div class="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white p-4 shadow-lg">
            <div class="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
              <p class="text-sm text-gray-800">Доступна нова версія додатка.</p>
              <div class="flex gap-2">
                <button type="button" class={btnSecondaryClass} onClick={() => $pwa.cancelPrompt()}>
                  Пізніше
                </button>
                <button
                  type="button"
                  class={btnPrimaryClass}
                  onClick={() => $pwa.updateServiceWorker()}
                >
                  Оновити
                </button>
              </div>
            </div>
          </div>
        )
      }

      if ($pwa.showInstallPrompt && !$pwa.isPWAInstalled) {
        return (
          <div class="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white p-4 shadow-lg">
            <div class="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
              <p class="text-sm text-gray-800">Встановіть Calories на пристрій для швидкого доступу.</p>
              <div class="flex gap-2">
                <button type="button" class={btnSecondaryClass} onClick={() => $pwa.cancelInstall()}>
                  Не зараз
                </button>
                <button type="button" class={btnPrimaryClass} onClick={() => $pwa.install()}>
                  Встановити
                </button>
              </div>
            </div>
          </div>
        )
      }

      return null
    }
  },
})

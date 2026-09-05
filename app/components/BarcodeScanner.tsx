import { defineComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import { btnSecondaryClass } from '~/utils/ui'

// Сканер штрихкодів на нативному BarcodeDetector (Chrome/Edge на Android і десктопі).
// Показувати лише коли `'BarcodeDetector' in window` — інакше падати на ручний ввід.

declare global {
  interface Window {
    BarcodeDetector?: BarcodeDetectorConstructor
  }
  interface BarcodeDetectorConstructor {
    new (options?: { formats?: string[] }): {
      detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>
    }
  }
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf']

export default defineComponent({
  name: 'BarcodeScanner',
  emits: {
    detected: (_code: string) => true,
    close: () => true,
  },
  setup(_props, { emit }) {
    const videoRef = ref<HTMLVideoElement | null>(null)
    const error = ref<string | null>(null)
    let stream: MediaStream | null = null
    let timer: ReturnType<typeof setInterval> | null = null
    let done = false

    function stop() {
      if (timer) {
        clearInterval(timer)
        timer = null
      }
      if (stream) {
        for (const track of stream.getTracks()) track.stop()
        stream = null
      }
    }

    async function start() {
      const Ctor = window.BarcodeDetector
      if (!Ctor) {
        error.value = 'Камерне сканування не підтримується цим браузером'
        return
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        })
      } catch {
        error.value = 'Немає доступу до камери. Дозвольте камеру або введіть код вручну.'
        return
      }
      const video = videoRef.value
      if (!video) return
      video.srcObject = stream
      await video.play().catch(() => undefined)

      const detector = new Ctor({ formats: FORMATS })
      timer = setInterval(async () => {
        if (done || !videoRef.value) return
        try {
          const hits = await detector.detect(videoRef.value)
          const code = hits[0]?.rawValue?.replace(/\D/g, '')
          if (code && code.length >= 6) {
            done = true
            stop()
            emit('detected', code)
          }
        } catch {
          // окремі кадри можуть не розпізнатись — ігноруємо
        }
      }, 350)
    }

    onMounted(start)
    onBeforeUnmount(stop)

    return () => (
      <div class="mt-4 rounded-xl border border-gray-200 bg-black/90 p-3">
        {error.value ? (
          <p class="rounded-lg bg-white/90 px-3 py-2 text-sm text-gray-700">{error.value}</p>
        ) : (
          <video
            ref={videoRef}
            muted
            playsinline
            class="mx-auto aspect-video w-full max-w-md rounded-lg object-cover"
          />
        )}
        <div class="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => {
              stop()
              emit('close')
            }}
            class={btnSecondaryClass}
          >
            Закрити
          </button>
        </div>
        {!error.value && (
          <p class="mt-2 text-center text-xs text-white/70">
            Наведіть камеру на штрихкод продукту
          </p>
        )}
      </div>
    )
  },
})

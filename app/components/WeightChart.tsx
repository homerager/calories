import { defineComponent, computed, type PropType } from 'vue'
import type { WeightPoint } from '../composables/useProfile'

// Легкий SVG-графік динаміки ваги (без зовнішніх залежностей).

const VIEW_W = 640
const VIEW_H = 240
const PAD = { top: 16, right: 16, bottom: 28, left: 40 }

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
}

export default defineComponent({
  name: 'WeightChart',
  props: {
    points: {
      type: Array as PropType<WeightPoint[]>,
      required: true,
    },
  },
  setup(props) {
    const plotW = VIEW_W - PAD.left - PAD.right
    const plotH = VIEW_H - PAD.top - PAD.bottom

    const model = computed(() => {
      const pts = props.points
      if (pts.length === 0) return null

      const weights = pts.map((p) => p.weightKg)
      const times = pts.map((p) => new Date(p.measuredAt).getTime())

      const minW = Math.min(...weights)
      const maxW = Math.max(...weights)
      // Невеликий відступ по вертикалі, щоб лінія не липла до країв.
      const padW = Math.max(1, (maxW - minW) * 0.1)
      const lowW = minW - padW
      const highW = maxW + padW
      const rangeW = highW - lowW || 1

      const minT = Math.min(...times)
      const maxT = Math.max(...times)
      const rangeT = maxT - minT || 1

      const xy = pts.map((p, i) => {
        const t = new Date(p.measuredAt).getTime()
        const x =
          pts.length === 1
            ? PAD.left + plotW / 2
            : PAD.left + ((t - minT) / rangeT) * plotW
        const y = PAD.top + (1 - (p.weightKg - lowW) / rangeW) * plotH
        return { x, y, point: p, index: i }
      })

      const linePath = xy.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
      const areaPath =
        `${PAD.left + (pts.length === 1 ? plotW / 2 : 0)},${(PAD.top + plotH).toFixed(1)} ` +
        linePath +
        ` ${xy[xy.length - 1]!.x.toFixed(1)},${(PAD.top + plotH).toFixed(1)}`

      return {
        xy,
        linePath,
        areaPath,
        lowW,
        highW,
        first: pts[0]!,
        last: pts[pts.length - 1]!,
      }
    })

    return () => {
      const m = model.value

      if (!m) {
        return (
          <div class="flex h-48 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
            Ще немає записів ваги — додайте перше зважування.
          </div>
        )
      }

      const midW = (m.lowW + m.highW) / 2

      return (
        <svg
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          class="h-auto w-full"
          role="img"
          aria-label="Графік динаміки ваги"
        >
          {/* Горизонтальні лінії сітки + підписи ваги */}
          {[m.highW, midW, m.lowW].map((w, i) => {
            const y = PAD.top + (plotH / 2) * i
            return (
              <g key={`grid-${i}`}>
                <line
                  x1={PAD.left}
                  y1={y}
                  x2={VIEW_W - PAD.right}
                  y2={y}
                  stroke="#f1f5f9"
                  stroke-width="1"
                />
                <text x={PAD.left - 6} y={y + 4} text-anchor="end" class="fill-gray-400 text-[11px]">
                  {w.toFixed(1)}
                </text>
              </g>
            )
          })}

          <polygon points={m.areaPath} fill="#3a8d3a" fill-opacity="0.08" />

          <polyline
            points={m.linePath}
            fill="none"
            stroke="#2c6f2c"
            stroke-width="2"
            stroke-linejoin="round"
            stroke-linecap="round"
          />

          {m.xy.map((c) => (
            <circle key={c.point.id} cx={c.x} cy={c.y} r="3.5" fill="#2c6f2c">
              <title>
                {formatDate(c.point.measuredAt)}: {c.point.weightKg.toFixed(1)} кг
              </title>
            </circle>
          ))}

          {/* Підписи дат: перша й остання */}
          <text
            x={PAD.left}
            y={VIEW_H - 8}
            text-anchor="start"
            class="fill-gray-400 text-[11px]"
          >
            {formatDate(m.first.measuredAt)}
          </text>
          {m.first.id !== m.last.id && (
            <text
              x={VIEW_W - PAD.right}
              y={VIEW_H - 8}
              text-anchor="end"
              class="fill-gray-400 text-[11px]"
            >
              {formatDate(m.last.measuredAt)}
            </text>
          )}
        </svg>
      )
    }
  },
})

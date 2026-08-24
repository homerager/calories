import { defineComponent, computed, type PropType } from 'vue'
import { Bar } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import '~/utils/chartSetup'
import type { StatsDay } from '../composables/useStats'

// Інтерактивний графік добових калорій на Chart.js: стовпчики — калорії за день
// (червоні — перевищення норми), пунктирна лінія — цільова норма.

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`)
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
}

export default defineComponent({
  name: 'CaloriesChart',
  props: {
    days: {
      type: Array as PropType<StatsDay[]>,
      required: true,
    },
    norm: {
      type: Number as PropType<number | null>,
      default: null,
    },
  },
  setup(props) {
    const chartData = computed(() => {
      const norm = props.norm
      const datasets: unknown[] = [
        {
          type: 'bar' as const,
          label: 'Калорії',
          data: props.days.map((d) => Math.round(d.kcal)),
          backgroundColor: props.days.map((d) =>
            norm != null && norm > 0 && d.kcal > norm ? '#f87171' : '#3a8d3a',
          ),
          borderRadius: 4,
          maxBarThickness: 40,
        },
      ]
      if (norm != null && norm > 0) {
        datasets.push({
          type: 'line' as const,
          label: 'Норма',
          data: props.days.map(() => norm),
          borderColor: '#f59e0b',
          borderDash: [5, 4],
          borderWidth: 1.5,
          pointRadius: 0,
          fill: false,
        })
      }

      return {
        labels: props.days.map((d) => formatDate(d.date)),
        datasets,
      } as ChartData<'bar', number[], string>
    })

    const chartOptions = computed<ChartOptions<'bar'>>(() => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: props.norm != null && props.norm > 0,
          position: 'top',
          labels: { boxWidth: 12, font: { size: 11 } },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.formattedValue} ккал`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => `${v}` },
          grid: { color: '#f1f5f9' },
        },
        x: {
          grid: { display: false },
        },
      },
    }))

    return () => {
      if (props.days.length === 0) {
        return (
          <div class="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-400">
            Ще немає даних за цей період.
          </div>
        )
      }

      return (
        <div class="h-64">
          <Bar data={chartData.value} options={chartOptions.value} />
        </div>
      )
    }
  },
})

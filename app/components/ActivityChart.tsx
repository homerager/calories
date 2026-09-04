import { defineComponent, computed, type PropType } from 'vue'
import { Bar } from 'vue-chartjs'
import type { ChartData, ChartOptions } from 'chart.js'
import '~/utils/chartSetup'
import type { StatsDay } from '../composables/useStats'

// Інтерактивний графік добових калорій активності: стовпчики — спалено за день.

function formatDate(iso: string): string {
  const d = new Date(`${iso}T12:00:00.000Z`)
  return d.toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' })
}

export default defineComponent({
  name: 'ActivityChart',
  props: {
    days: {
      type: Array as PropType<StatsDay[]>,
      required: true,
    },
  },
  setup(props) {
    const hasActivity = computed(() => props.days.some((d) => d.burned > 0))

    const chartData = computed<ChartData<'bar', number[], string>>(() => ({
      labels: props.days.map((d) => formatDate(d.date)),
      datasets: [
        {
          label: 'Спалено',
          data: props.days.map((d) => Math.round(d.burned)),
          backgroundColor: '#34d399',
          borderRadius: 4,
          maxBarThickness: 40,
        },
      ],
    }))

    const chartOptions = computed<ChartOptions<'bar'>>(() => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
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
          grid: { color: '#e2e8f0' },
        },
        x: {
          grid: { display: false },
        },
      },
    }))

    return () => {
      if (props.days.length === 0 || !hasActivity.value) {
        return (
          <div class="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 text-sm text-gray-500">
            {props.days.length === 0
              ? 'Ще немає даних за цей період.'
              : 'Немає записів активності за цей період.'}
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

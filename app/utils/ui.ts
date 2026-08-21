// Спільні Tailwind-класи для інпутів і кнопок. Підключені в tailwind.config.ts
// (`content` включає `app/utils`), тож класи не викидаються з CSS.

export const labelClass = 'block text-sm font-medium text-gray-700'

export const inputClass =
  'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200'

/** Інпут без `mt-1` / `w-full` — для компактних рядків (дата, вага). */
export const inputClassCompact =
  'rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200'

export const btnPrimaryClass =
  'rounded-lg bg-brand-600 px-4 py-2 font-medium text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60'

export const btnSecondaryClass =
  'rounded-lg border border-gray-300 px-4 py-2 font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60'

export const btnDangerClass =
  'rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-300 disabled:cursor-not-allowed disabled:opacity-60'

export const btnGhostClass =
  'rounded-lg px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-not-allowed disabled:opacity-60'

export const btnTabActiveClass = 'rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white'
export const btnTabIdleClass =
  'rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-200'

export const linkDangerClass =
  'text-sm font-medium text-red-700 hover:text-red-800 focus:outline-none focus:underline disabled:opacity-50'

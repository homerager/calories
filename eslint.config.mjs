// @nuxt/eslint генерує базову flat-конфігурацію у .nuxt під час `nuxt prepare`.
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // Згенерований Prisma Client — не лінтимо.
  { ignores: ['prisma/generated/**'] },
  // Тут можна додати власні правила / оверрайди.
)

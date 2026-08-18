import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

// Prisma ORM 7: конфіг CLI (розташування схеми, міграції, seed, підключення).
// .env не завантажується автоматично — тягнемо через dotenv вище.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
})

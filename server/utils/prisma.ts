import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../../prisma/generated/client/client'

// Prisma ORM 7 вимагає driver adapter. Використовуємо @prisma/adapter-pg.
// Singleton, щоб уникнути вичерпання пулу зʼєднань під час dev-HMR.
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
}

function createPrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set')
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrisma()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma

import { prisma } from '../utils/prisma'
import { decrypt } from '../utils/crypto'

// Історія зважувань поточного користувача (розшифрована, за зростанням дати — зручно для графіка).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const logs = await prisma.weightLog.findMany({
    where: { userId: user.id },
    orderBy: { measuredAt: 'asc' },
    select: { id: true, weightEnc: true, measuredAt: true },
  })

  const entries = logs
    .map((log) => {
      let weightKg: number | null = null
      try {
        weightKg = Number(decrypt(log.weightEnc))
      } catch {
        weightKg = null
      }
      return weightKg != null && Number.isFinite(weightKg)
        ? { id: log.id, weightKg, measuredAt: log.measuredAt.toISOString() }
        : null
    })
    .filter((e): e is { id: string; weightKg: number; measuredAt: string } => e !== null)

  return { entries }
})

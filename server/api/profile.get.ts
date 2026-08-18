import { prisma } from '../utils/prisma'
import { toProfileResponse } from '../utils/profileResponse'

// Повертає профіль поточного користувача (з розшифрованими зростом/вагою та нормами).
export default defineEventHandler(async (event) => {
  const { user } = await requireUserSession(event)

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } })
  if (!profile) {
    return { profile: null }
  }

  return { profile: toProfileResponse(profile) }
})

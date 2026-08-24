import { findOrCreateOAuthUser } from '../../utils/oauthUser'

// OAuth-вхід через Google. Callback URL: `<APP_URL>/auth/google`.
// Конфіг clientId/clientSecret береться з runtimeConfig.oauth.google.
export default defineOAuthGoogleEventHandler({
  config: {
    scope: ['openid', 'email', 'profile'],
  },
  async onSuccess(event, { user }) {
    const email: string | undefined = user.email
    if (!email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'Google не повернув email',
      })
    }

    const dbUser = await findOrCreateOAuthUser({
      provider: 'google',
      providerUserId: String(user.sub),
      email,
    })

    await setUserSession(event, {
      user: { id: dbUser.id, email: dbUser.email },
      loggedInAt: Date.now(),
    })

    return sendRedirect(event, dbUser.isNew ? '/onboarding' : '/')
  },
  onError(event, error) {
    console.error('Google OAuth error:', error)
    return sendRedirect(event, '/login?error=oauth')
  },
})

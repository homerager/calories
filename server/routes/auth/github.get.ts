import { findOrCreateOAuthUser } from '../../utils/oauthUser'

// OAuth-вхід через GitHub. Callback URL: `<APP_URL>/auth/github`.
// Конфіг clientId/clientSecret береться з runtimeConfig.oauth.github.
export default defineOAuthGitHubEventHandler({
  config: {
    // Просимо доступ до email — GitHub може ховати публічний email.
    scope: ['user:email'],
    emailRequired: true,
  },
  async onSuccess(event, { user }) {
    const email: string | null | undefined = user.email
    if (!email) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Bad Request',
        message: 'GitHub не повернув email',
      })
    }

    const dbUser = await findOrCreateOAuthUser({
      provider: 'github',
      providerUserId: String(user.id),
      email,
    })

    await setUserSession(event, {
      user: { id: dbUser.id, email: dbUser.email },
      loggedInAt: Date.now(),
    })

    return sendRedirect(event, '/')
  },
  onError(event, error) {
    console.error('GitHub OAuth error:', error)
    return sendRedirect(event, '/login?error=oauth')
  },
})

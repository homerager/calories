// Для сторінок лише для гостей (login/register). Авторизованих — на /diary.
export default defineNuxtRouteMiddleware(() => {
  const { loggedIn } = useUserSession()
  if (loggedIn.value) {
    return navigateTo('/')
  }
})

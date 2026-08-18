// Типізація сесії nuxt-auth-utils (модуль `#auth-utils`).
// Дані користувача у сесії тримаємо мінімальні (без чутливих полів).
declare module '#auth-utils' {
  interface User {
    id: string
    email: string
  }

  interface UserSession {
    // Час входу (epoch ms) — для аудиту/діагностики.
    loggedInAt?: number
  }

  interface SecureSessionData {
    // Місце для серверних (незашифрованих для клієнта) даних сесії за потреби.
  }
}

export {}

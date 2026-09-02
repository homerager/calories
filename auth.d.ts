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
    // true, якщо сесію відкрито через Bearer-токен (мобільний клієнт), а не cookie.
    viaApiToken?: boolean
  }

  interface SecureSessionData {
    // Місце для серверних (незашифрованих для клієнта) даних сесії за потреби.
    _unused?: never
  }
}

// id Bearer-токена поточного запиту (виставляє server/middleware/bearerAuth.ts).
declare module 'h3' {
  interface H3EventContext {
    apiTokenId?: string
  }
}

export {}

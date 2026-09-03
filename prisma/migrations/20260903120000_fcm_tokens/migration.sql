-- FCM-токени пристроїв (мобільний застосунок) для push-сповіщень.

CREATE TABLE "FcmToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FcmToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FcmToken_token_key" ON "FcmToken"("token");
CREATE INDEX "FcmToken_userId_idx" ON "FcmToken"("userId");

ALTER TABLE "FcmToken" ADD CONSTRAINT "FcmToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

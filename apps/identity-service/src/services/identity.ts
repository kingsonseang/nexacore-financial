import * as argon2 from 'argon2'
import { eq } from 'drizzle-orm'
import { Data, Effect } from 'effect'
import { jwtVerify, SignJWT } from 'jose'
import { AppConfig } from '../config/index.js'
import { DatabaseService } from '../db/client.js'
import { users } from '../db/schema.js'

// --- Errors ---

export class UserAlreadyExistsError extends Data.TaggedError(
  'UserAlreadyExistsError',
)<{ email: string }> {}

export class UserNotFoundError extends Data.TaggedError('UserNotFoundError')<{
  email: string
}> {}

export class InvalidPasswordError extends Data.TaggedError(
  'InvalidPasswordError',
) {}

export class InvalidTokenError extends Data.TaggedError('InvalidTokenError')<{
  reason: string
}> {}

export class InfrastructureError extends Data.TaggedError(
  'InfrastructureError',
)<{ cause: unknown }> {}

// --- Register ---

export const register = (params: {
  email: string
  password: string
  firstName: string
  lastName: string
  middleName?: string
}) =>
  Effect.gen(function* () {
    const db = yield* DatabaseService

    const existing = yield* Effect.tryPromise({
      try: () =>
        db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.email, params.email.toLowerCase()))
          .limit(1),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    if (existing.length > 0) {
      return yield* Effect.fail(
        new UserAlreadyExistsError({ email: params.email }),
      )
    }

    const passwordHash = yield* Effect.tryPromise({
      try: () => argon2.hash(params.password),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    const [user] = yield* Effect.tryPromise({
      try: () =>
        db
          .insert(users)
          .values({
            email: params.email.toLowerCase(),
            passwordHash,
            firstName: params.firstName,
            lastName: params.lastName,
            middleName: params.middleName,
          })
          .returning({ id: users.id, email: users.email }),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    return user
  })

// --- Login ---

export const login = (email: string, password: string) =>
  Effect.gen(function* () {
    const db = yield* DatabaseService
    const jwtSecret = yield* AppConfig.auth.jwtSecret
    const jwtExpiresIn = yield* AppConfig.auth.jwtExpiresIn
    const refreshSecret = yield* AppConfig.auth.refreshSecret
    const refreshExpiresIn = yield* AppConfig.auth.refreshExpiresIn

    const [user] = yield* Effect.tryPromise({
      try: () =>
        db
          .select()
          .from(users)
          .where(eq(users.email, email.toLowerCase()))
          .limit(1),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    if (!user) {
      return yield* Effect.fail(new UserNotFoundError({ email }))
    }

    const valid = yield* Effect.tryPromise({
      try: () => argon2.verify(user.passwordHash, password),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    if (!valid) {
      return yield* Effect.fail(new InvalidPasswordError())
    }

    const secretKey = new TextEncoder().encode(jwtSecret)
    const refreshKey = new TextEncoder().encode(refreshSecret)

    const accessToken = yield* Effect.tryPromise({
      try: () =>
        new SignJWT({ sub: user.id, email: user.email })
          .setProtectedHeader({ alg: 'HS256' })
          .setExpirationTime(jwtExpiresIn)
          .sign(secretKey),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    const refreshToken = yield* Effect.tryPromise({
      try: () =>
        new SignJWT({ sub: user.id })
          .setProtectedHeader({ alg: 'HS256' })
          .setExpirationTime(refreshExpiresIn)
          .sign(refreshKey),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    return { accessToken, refreshToken }
  })

// --- VerifyToken ---

export const verifyToken = (token: string) =>
  Effect.gen(function* () {
    const jwtSecret = yield* AppConfig.auth.jwtSecret
    const secretKey = new TextEncoder().encode(jwtSecret)

    const { payload } = yield* Effect.tryPromise({
      try: () => jwtVerify(token, secretKey),
      catch: () =>
        new InvalidTokenError({ reason: 'Invalid or expired token' }),
    })

    return {
      userId: payload.sub as string,
      email: payload.email as string,
    }
  })

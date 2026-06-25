import { HttpServerRequest } from '@effect/platform'
import { Context, Data, Effect } from 'effect'
import { jwtVerify } from 'jose'
import { AppConfig } from '../config/index.js'

export interface CurrentUserData {
  email: string
  userId: string
}

export const CurrentUser = Context.GenericTag<CurrentUserData>(
  '@nexacore/gateway/CurrentUser',
)

export class UnauthorizedError extends Data.TaggedError('UnauthorizedError')<{
  reason: string
}> {}

/*
 * The gateway verifies JWTs directly using the shared JWT_SECRET rather than
 * calling identity-service's VerifyToken over gRPC on every protected request.
 * Both services hold the same secret. This avoids an extra network round trip
 * per request — identity-service's VerifyToken stays available for other
 * internal consumers that need it.
 */
export const requireAuth = Effect.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest
  const authHeader = request.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    return yield* Effect.fail(
      new UnauthorizedError({
        reason: 'Missing or invalid Authorization header',
      }),
    )
  }

  const token = authHeader.slice(7)
  const jwtSecret = yield* AppConfig.auth.jwtSecret
  const secretKey = new TextEncoder().encode(jwtSecret)

  const { payload } = yield* Effect.tryPromise({
    try: () => jwtVerify(token, secretKey),
    catch: () => new UnauthorizedError({ reason: 'Invalid or expired token' }),
  })

  return {
    userId: payload.sub as string,
    email: payload.email as string,
  }
})

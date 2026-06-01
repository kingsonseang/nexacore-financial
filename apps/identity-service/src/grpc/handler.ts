import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect'
import { IdentityPb, type MessageShape } from '@org/protos'
import { Effect, Either, Layer, ManagedRuntime } from 'effect'
import { DatabaseLive, type DrizzleDB } from '../db/client.js'
import * as identity from '../services/identity.js'

// --- Runtime ---

const AppLayer = Layer.mergeAll(DatabaseLive)
const runtime = ManagedRuntime.make(AppLayer)

// --- Error helpers ---

const fail = (message: string, code: Code) =>
  Effect.fail(new ConnectError(message, code))

const internalError = fail('Internal server error', Code.Internal)

/*
 * runHandler uses Effect.either to move failures into the success channel
 * before passing to runtime.runPromise. runPromise wraps all Effect failures
 * in FiberFailure regardless of type — ConnectRPC does not recognise
 * FiberFailure and falls back to Code.Internal for every failure, even when
 * the error is already a correctly typed ConnectError. Effect.either prevents
 * any failure from reaching runPromise, so the ConnectError is extracted from
 * Either.Left and thrown directly. ConnectRPC then receives a real ConnectError
 * and maps it to the correct gRPC status code.
 */
const runHandler = async <A, R>(
  effect: Effect.Effect<A, ConnectError, R>,
): Promise<A> => {
  const either = Effect.either(effect) as unknown as Effect.Effect<
    Either.Either<A, ConnectError>,
    never,
    DrizzleDB
  >
  const result = await runtime.runPromise(either)
  if (Either.isLeft(result)) {
    throw result.left
  }
  return result.right
}

// --- Routes ---

export const identityRoutes = (router: ConnectRouter) =>
  /* biome-ignore lint/suspicious/noExplicitAny: router.service UnaryImpl is
   * incompatible with protobuf-es v2 branded message types ($typeName brand).
   * Casting at the boundary so handler internals remain fully type-safe.
   * Track: github.com/connectrpc/connect-es/issues for v2.x resolution.
   */
  (router.service as any)(IdentityPb.IdentityService, {
    /*
     * Request parameters use MessageShape<typeof Schema> explicitly because
     * @connectrpc/connect's UnaryImpl passes Message<string> as the base type,
     * breaking inference of specific proto message types. MessageShape resolves
     * to the same type as the generated message alias — not a cast.
     */
    register: (req: MessageShape<typeof IdentityPb.RegisterRequestSchema>) =>
      runHandler(
        identity
          .register({
            email: req.email,
            password: req.password,
            firstName: req.firstName,
            lastName: req.lastName,
            middleName: req.middleName || undefined,
          })
          .pipe(
            Effect.map((user) => ({ userId: user.id, email: user.email })),
            Effect.catchTags({
              UserAlreadyExistsError: () =>
                fail('Email already in use', Code.AlreadyExists),
              InfrastructureError: () => internalError,
            }),
            Effect.catchAll(() => internalError),
          ),
      ),

    /*
     * Request parameters use MessageShape<typeof Schema> explicitly because
     * @connectrpc/connect's UnaryImpl passes Message<string> as the base type,
     * breaking inference of specific proto message types. MessageShape resolves
     * to the same type as the generated message alias — not a cast.
     */
    login: (req: MessageShape<typeof IdentityPb.LoginRequestSchema>) =>
      runHandler(
        identity.login(req.email, req.password).pipe(
          Effect.map(({ accessToken, refreshToken }) => ({
            accessToken,
            refreshToken,
          })),
          Effect.tapError((e) => Effect.logError('verifyToken error', e)),
          Effect.catchTags({
            UserNotFoundError: () => fail('User not found', Code.NotFound),
            InvalidPasswordError: () =>
              fail('Invalid credentials', Code.Unauthenticated),
            InfrastructureError: () => internalError,
          }),
          Effect.catchAll(() => internalError),
        ),
      ),

    /*
     * Request parameters use MessageShape<typeof Schema> explicitly because
     * @connectrpc/connect's UnaryImpl passes Message<string> as the base type,
     * breaking inference of specific proto message types. MessageShape resolves
     * to the same type as the generated message alias — not a cast.
     */
    verifyToken: (
      req: MessageShape<typeof IdentityPb.VerifyTokenRequestSchema>,
    ) =>
      runHandler(
        identity.verifyToken(req.token).pipe(
          Effect.map(({ userId, email }) => ({
            userId,
            email,
            valid: true,
          })),
          Effect.catchTags({
            InvalidTokenError: (e) => fail(e.reason, Code.Unauthenticated),
          }),
          Effect.catchAll(() => internalError),
        ),
      ),
  })

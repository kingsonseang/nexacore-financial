import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect'
import { IdentityPb, type MessageShape } from '@org/protos'
import { Effect, Layer, ManagedRuntime } from 'effect'
import { DatabaseLive } from '../db/client.js'
import * as identity from '../services/identity.js'

// --- Runtime ---

const AppLayer = Layer.mergeAll(DatabaseLive)
const runtime = ManagedRuntime.make(AppLayer)

// --- Error helpers ---

const fail = (message: string, code: Code) =>
  Effect.fail(new ConnectError(message, code))

const internalError = fail('Internal server error', Code.Internal)

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
      runtime.runPromise(
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
            Effect.tapError((e) => Effect.logError('verifyToken error', e)),
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
      runtime.runPromise(
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
      runtime.runPromise(
        identity.verifyToken(req.token).pipe(
          Effect.map(({ userId, email }) => ({
            userId,
            email,
            valid: true,
          })),
          Effect.tapError((e) => Effect.logError('verifyToken error', e)),
          Effect.catchTags({
            InvalidTokenError: (e) => fail(e.reason, Code.Unauthenticated),
          }),
          Effect.catchAll(() => internalError),
        ),
      ),
  })

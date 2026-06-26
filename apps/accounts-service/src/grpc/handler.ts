import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect'
import { AccountsPb, type MessageShape } from '@org/protos'
import { Effect, Either, Layer, ManagedRuntime } from 'effect'
import { DatabaseLive, type DrizzleDB } from '../db/client.js'
import type { CurrencyEnum } from '../db/schema.js'
import * as accounts from '../services/accounts.js'

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
  effect: Effect.Effect<A, ConnectError | unknown, R>,
): Promise<A> => {
  const either = Effect.either(effect) as unknown as Effect.Effect<
    Either.Either<A, ConnectError | unknown>,
    never,
    DrizzleDB
  >
  const result = await runtime.runPromise(either)
  if (Either.isLeft(result)) {
    throw result.left
  }
  return result.right
}

// --- gRPC helpers ---

const toDbCurrency = (currency: AccountsPb.Currency): CurrencyEnum => {
  switch (currency) {
    case AccountsPb.Currency.NGN:
      return 'NGN'
    case AccountsPb.Currency.USD:
      return 'USD'
    default:
      throw new ConnectError('Invalid currency', Code.InvalidArgument)
  }
}

const toProtoCurrency = (currency: CurrencyEnum): AccountsPb.Currency =>
  currency === 'NGN' ? AccountsPb.Currency.NGN : AccountsPb.Currency.USD

// --- Routes ---

export const accountsRoutes = (router: ConnectRouter) =>
  /* biome-ignore lint/suspicious/noExplicitAny: router.service UnaryImpl is
   * incompatible with protobuf-es v2 branded message types ($typeName brand).
   * Casting at the boundary so handler internals remain fully type-safe.
   * Track: github.com/connectrpc/connect-es/issues for v2.x resolution.
   */
  (router.service as any)(AccountsPb.AccountsService, {
    /*
     * Request parameters use MessageShape<typeof Schema> explicitly because
     * @connectrpc/connect's UnaryImpl passes Message<string> as the base type,
     * breaking inference of specific proto message types. MessageShape resolves
     * to the same type as the generated message alias — not a cast.
     */
    createAccount: (
      req: MessageShape<typeof AccountsPb.CreateAccountRequestSchema>,
    ) =>
      runHandler(
        accounts.createAccount(req.userId).pipe(
          Effect.map((wallets) => ({
            accountId: req.userId,
            wallets: wallets.map((wallet) => ({
              walletId: wallet.id,
              userId: wallet.userId,
              currency: toProtoCurrency(wallet.currency),
              balance: wallet.balance,
              createdAt: wallet.createdAt.toISOString(),
            })),
          })),
          Effect.catchTags({
            AccountAlreadyExistsError: () =>
              fail('Account already exists', Code.AlreadyExists),
            InfrastructureError: () => internalError,
          }),
        ),
      ),

    /*
     * Request parameters use MessageShape<typeof Schema> explicitly because
     * @connectrpc/connect's UnaryImpl passes Message<string> as the base type,
     * breaking inference of specific proto message types. MessageShape resolves
     * to the same type as the generated message alias — not a cast.
     */
    getAccount: (
      req: MessageShape<typeof AccountsPb.GetAccountRequestSchema>,
    ) =>
      runHandler(
        accounts.getAccount(req.userId).pipe(
          Effect.map((account) => ({
            accountId: account.accountId,
            userId: account.userId,
            wallets: account.wallets.map((wallet) => ({
              walletId: wallet.id,
              userId: wallet.userId,
              currency: toProtoCurrency(wallet.currency),
              balance: wallet.balance,
              createdAt: wallet.createdAt.toISOString(),
            })),
          })),
          Effect.catchTags({
            AccountNotFoundError: () =>
              fail('Account not found', Code.NotFound),
            InfrastructureError: () => internalError,
          }),
        ),
      ),

    /*
     * Request parameters use MessageShape<typeof Schema> explicitly because
     * @connectrpc/connect's UnaryImpl passes Message<string> as the base type,
     * breaking inference of specific proto message types. MessageShape resolves
     * to the same type as the generated message alias — not a cast.
     */
    listWallets: (
      req: MessageShape<typeof AccountsPb.ListWalletsRequestSchema>,
    ) =>
      runHandler(
        accounts.listWallets(req.userId).pipe(
          Effect.map((wallets) =>
            wallets.map((wallet) => ({
              id: wallet.id,
              userId: wallet.userId,
              currency: wallet.currency,
              balance: wallet.balance,
              createdAt: wallet.createdAt,
            })),
          ),
          Effect.catchTags({
            AccountNotFoundError: () =>
              fail('Account not found', Code.NotFound),
            InfrastructureError: () => internalError,
          }),
        ),
      ),

    /*
     * Request parameters use MessageShape<typeof Schema> explicitly because
     * @connectrpc/connect's UnaryImpl passes Message<string> as the base type,
     * breaking inference of specific proto message types. MessageShape resolves
     * to the same type as the generated message alias — not a cast.
     */
    getBalance: (
      req: MessageShape<typeof AccountsPb.GetBalanceRequestSchema>,
    ) =>
      runHandler(
        accounts.getBalance(req.userId, toDbCurrency(req.currency)).pipe(
          Effect.map((wallet) => ({
            currency: toProtoCurrency(wallet.currency),
            balance: wallet.balance,
          })),
          Effect.catchTags({
            AccountNotFoundError: () =>
              fail('Account not found', Code.NotFound),
            InfrastructureError: () => internalError,
          }),
        ),
      ),
  })

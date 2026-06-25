import { and, eq } from 'drizzle-orm'
import { Data, Effect } from 'effect'
import { DatabaseService } from '../db/client.js'
import { type Wallet, wallets } from '../db/schema.js'

export class AccountAlreadyExistsError extends Data.TaggedError(
  'AccountAlreadyExistsError',
)<{ userId: string }> {}

export class AccountNotFoundError extends Data.TaggedError(
  'AccountNotFoundError',
)<{
  userId: string
}> {}

export class InfrastructureError extends Data.TaggedError(
  'InfrastructureError',
)<{
  cause: unknown
}> {}

export const createAccount = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* DatabaseService

    const existing = yield* Effect.tryPromise<Wallet[], InfrastructureError>({
      try: () => db.select().from(wallets).where(eq(wallets.userId, userId)),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    if (existing.length > 0) {
      return yield* Effect.fail(new AccountAlreadyExistsError({ userId }))
    }

    const created = yield* Effect.tryPromise<Wallet[], InfrastructureError>({
      try: () =>
        db
          .insert(wallets)
          .values([
            { userId, currency: 'NGN' },
            { userId, currency: 'USD' },
          ])
          .returning(),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    return created
  })

/*
 * accountId is currently synthesized from userId since there is no separate
 * accounts table yet — one user maps to exactly one implicit account.
 * Revisit with a real accounts table if multi-account-per-user is ever needed.
 */
export const getAccount = (userId: string) =>
  Effect.gen(function* () {
    const userWallets = yield* listWallets(userId)
    return { accountId: userId, userId, wallets: userWallets }
  })

export const listWallets = (userId: string) =>
  Effect.gen(function* () {
    const db = yield* DatabaseService

    const userWallets = yield* Effect.tryPromise<Wallet[], InfrastructureError>(
      {
        try: () => db.select().from(wallets).where(eq(wallets.userId, userId)),
        catch: (cause) => new InfrastructureError({ cause }),
      },
    )

    if (userWallets.length === 0) {
      return yield* Effect.fail(new AccountNotFoundError({ userId }))
    }

    return userWallets
  })

export const getBalance = (userId: string, currency: 'NGN' | 'USD') =>
  Effect.gen(function* () {
    const db = yield* DatabaseService

    const [wallet] = yield* Effect.tryPromise<Wallet[], InfrastructureError>({
      try: () =>
        db
          .select()
          .from(wallets)
          .where(
            and(eq(wallets.userId, userId), eq(wallets.currency, currency)),
          )
          .limit(1),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    if (!wallet) {
      return yield* Effect.fail(new AccountNotFoundError({ userId }))
    }

    return wallet
  })

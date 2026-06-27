import { randomUUID } from 'node:crypto'
import type { ProviderError } from '@org/payment-providers'
import { eq } from 'drizzle-orm'
import { Data, Effect } from 'effect'
import { DatabaseService } from '../db/client.js'
import { type CurrencyEnum, type Payment, payments } from '../db/schema.js'
import { ProviderRegistryService } from '../providers/registry.js'

export class PaymentNotFoundError extends Data.TaggedError(
  'PaymentNotFoundError',
)<{ paymentId: string }> {}

export class InfrastructureError extends Data.TaggedError(
  'InfrastructureError',
)<{ cause: unknown }> {}

/*
 * Converts a decimal amount string ("500.00") to integer minor units (50000)
 * without floating point arithmetic, since parseFloat(amount) * 100 risks
 * precision errors on certain decimal values. Consistent with this project's
 * existing convention of treating monetary amounts as strings end-to-end.
 */
const toMinorUnits = (amount: string): number => {
  const [whole, fraction = '0'] = amount.split('.')
  const paddedFraction = fraction.padEnd(2, '0').slice(0, 2)
  return Number.parseInt(whole, 10) * 100 + Number.parseInt(paddedFraction, 10)
}

export const createDepositIntent = (params: {
  userId: string
  amount: string
  currency: CurrencyEnum
  email: string
}) =>
  Effect.gen(function* () {
    const db = yield* DatabaseService
    const providers = yield* ProviderRegistryService
    const reference = `dep_${randomUUID()}`

    const provider = providers.providerFor(params.currency)

    const { paymentUrl } = yield* provider
      .initializeDeposit({
        email: params.email,
        amountMinorUnits: toMinorUnits(params.amount),
        reference,
      })
      .pipe(
        Effect.mapError(
          (cause: ProviderError) => new InfrastructureError({ cause }),
        ),
      )

    const [payment] = yield* Effect.tryPromise<Payment[], InfrastructureError>({
      try: () =>
        db
          .insert(payments)
          .values({
            userId: params.userId,
            amount: params.amount,
            currency: params.currency,
            type: 'deposit',
            status: 'pending',
            reference,
            paymentUrl,
          })
          .returning(),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    return payment
  })

export const createWithdrawIntent = (params: {
  userId: string
  amount: string
  currency: CurrencyEnum
  bankCode: string
  accountNumber: string
}) =>
  Effect.gen(function* () {
    const db = yield* DatabaseService
    const reference = `wd_${randomUUID()}`

    const [payment] = yield* Effect.tryPromise<Payment[], InfrastructureError>({
      try: () =>
        db
          .insert(payments)
          .values({
            userId: params.userId,
            amount: params.amount,
            currency: params.currency,
            type: 'withdrawal',
            status: 'pending',
            reference,
            bankCode: params.bankCode,
            accountNumber: params.accountNumber,
          })
          .returning(),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    return payment
  })

export const getPaymentStatus = (paymentId: string, userId: string) =>
  Effect.gen(function* () {
    const db = yield* DatabaseService

    const [payment] = yield* Effect.tryPromise<Payment[], InfrastructureError>({
      try: () =>
        db.select().from(payments).where(eq(payments.id, paymentId)).limit(1),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    if (!payment || payment.userId !== userId) {
      return yield* Effect.fail(new PaymentNotFoundError({ paymentId }))
    }

    return payment
  })

export const listPayments = (params: {
  userId: string
  page: number
  pageSize: number
}) =>
  Effect.gen(function* () {
    const db = yield* DatabaseService
    const offset = (params.page - 1) * params.pageSize

    const userPayments = yield* Effect.tryPromise<
      Payment[],
      InfrastructureError
    >({
      try: () =>
        db
          .select()
          .from(payments)
          .where(eq(payments.userId, params.userId))
          .limit(params.pageSize)
          .offset(offset),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    return userPayments
  })

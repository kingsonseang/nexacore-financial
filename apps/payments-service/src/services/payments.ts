import { randomUUID } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { Data, Effect } from 'effect'
import { DatabaseService } from '../db/client.js'
import { type CurrencyEnum, type Payment, payments } from '../db/schema.js'

export class PaymentNotFoundError extends Data.TaggedError(
  'PaymentNotFoundError',
)<{ paymentId: string }> {}

export class InfrastructureError extends Data.TaggedError(
  'InfrastructureError',
)<{ cause: unknown }> {}

/*
 * createDepositIntent and createWithdrawIntent currently mock the Paystack
 * call instead of hitting the real API. This lets the full request flow
 * (HTTP -> gateway -> gRPC -> DB -> response) be validated end-to-end before
 * introducing a real provider integration. Replace mockInitiatePaystackPayment
 * with a real libs/payment-providers client once this slice is working.
 */
const mockInitiatePaystackPayment = (reference: string) =>
  Effect.succeed({
    paymentUrl: `https://checkout.paystack.com/mock/${reference}`,
  })

export const createDepositIntent = (params: {
  userId: string
  amount: string
  currency: CurrencyEnum
  email: string
}) =>
  Effect.gen(function* () {
    const db = yield* DatabaseService
    const reference = `dep_${randomUUID()}`

    const { paymentUrl } = yield* mockInitiatePaystackPayment(reference)

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

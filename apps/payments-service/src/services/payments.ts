import { randomUUID } from 'node:crypto'
import type { ProviderError } from '@org/payment-providers'
import { fromMinorUnits, toMinorUnits } from '@org/payment-providers'
import { LedgerPb } from '@org/protos'
import { eq } from 'drizzle-orm'
import { Data, Effect } from 'effect'
import { DatabaseService } from '../db/client.js'
import { type CurrencyEnum, type Payment, payments } from '../db/schema.js'
import { LedgerClient } from '../grpc/clients/ledger.js'
import { ProviderRegistryService } from '../providers/registry.js'

export class AmountMismatchError extends Data.TaggedError(
  'AmountMismatchError',
)<{
  expected: string
  received: string
}> {}

export class InvalidSignatureError extends Data.TaggedError(
  'InvalidSignatureError',
)<{ provider: string }> {}

export class UnsupportedProviderError extends Data.TaggedError(
  'UnsupportedProviderError',
)<{ provider: string }> {}

export class PaymentNotFoundError extends Data.TaggedError(
  'PaymentNotFoundError',
)<{ paymentId: string }> {}

export class InfrastructureError extends Data.TaggedError(
  'InfrastructureError',
)<{ cause: unknown }> {}

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

export const confirmWebhook = (params: {
  providerName: string
  rawBody: string
  signature: string
}) =>
  Effect.gen(function* () {
    const db = yield* DatabaseService
    const providers = yield* ProviderRegistryService
    const ledger = yield* LedgerClient
    const provider = providers.providerByName(params.providerName)

    if (!provider) {
      return yield* Effect.fail(
        new UnsupportedProviderError({ provider: params.providerName }),
      )
    }

    const valid = provider.verifyWebhookSignature(
      params.rawBody,
      params.signature,
    )
    if (!valid) {
      return yield* Effect.fail(
        new InvalidSignatureError({ provider: params.providerName }),
      )
    }

    const event = provider.parseWebhookEvent(params.rawBody)
    if (!event) {
      return { handled: false, paymentId: '', status: 'ignored' as const }
    }

    const [payment] = yield* Effect.tryPromise<Payment[], InfrastructureError>({
      try: () =>
        db
          .select()
          .from(payments)
          .where(eq(payments.reference, event.reference))
          .limit(1),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    if (!payment) {
      return yield* Effect.fail(
        new PaymentNotFoundError({ paymentId: event.reference }),
      )
    }

    /*
     * Paystack retries webhooks on non-2xx responses and can deliver the
     * same event more than once. Once a payment is already completed or
     * failed, treat further deliveries as a no-op rather than posting a
     * duplicate ledger entry.
     */
    if (payment.status === 'completed' || payment.status === 'failed') {
      return { handled: true, paymentId: payment.id, status: payment.status }
    }

    const newStatus = event.type === 'deposit_success' ? 'completed' : 'failed'

    /*
     * Amount is verified before the DB status is updated or the ledger entry
     * is posted. A mismatch must leave the payment in its current state
     * (still pending) rather than marking it completed without crediting
     * the ledger — the two need to either both happen or neither happen.
     */
    if (newStatus === 'completed') {
      const receivedAmount = fromMinorUnits(event.amountMinorUnits)
      if (receivedAmount !== payment.amount) {
        return yield* Effect.fail(
          new AmountMismatchError({
            expected: payment.amount,
            received: receivedAmount,
          }),
        )
      }
    }

    yield* Effect.tryPromise<unknown, InfrastructureError>({
      try: () =>
        db
          .update(payments)
          .set({ status: newStatus, updatedAt: new Date() })
          .where(eq(payments.id, payment.id)),
      catch: (cause) => new InfrastructureError({ cause }),
    })

    if (newStatus === 'completed') {
      yield* Effect.tryPromise<unknown, InfrastructureError>({
        try: () =>
          ledger.postEntry({
            accountId: payment.userId,
            amount: payment.amount,
            currency:
              payment.currency === 'NGN'
                ? LedgerPb.Currency.NGN
                : LedgerPb.Currency.USD,
            type: LedgerPb.EntryType.CREDIT,
            reference: payment.reference,
            description: `Deposit via ${params.providerName}`,
          }) as Promise<unknown>,
        catch: (cause) => new InfrastructureError({ cause }),
      })
    }

    return { handled: true, paymentId: payment.id, status: newStatus }
  })

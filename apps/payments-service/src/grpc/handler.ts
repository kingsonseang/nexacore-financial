import { Code, ConnectError, type ConnectRouter } from '@connectrpc/connect'
import { type MessageShape, PaymentsPb } from '@org/protos'
import { Effect, Either, Layer, ManagedRuntime } from 'effect'
import { DatabaseLive, type DrizzleDB } from '../db/client.js'
import type { Payment } from '../db/schema.js'
import * as payments from '../services/payments.js'

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

const toDbCurrency = (currency: PaymentsPb.Currency): 'NGN' | 'USD' => {
  switch (currency) {
    case PaymentsPb.Currency.NGN:
      return 'NGN'
    case PaymentsPb.Currency.USD:
      return 'USD'
    default:
      throw new ConnectError('Invalid currency', Code.InvalidArgument)
  }
}

const toProtoCurrency = (currency: 'NGN' | 'USD'): PaymentsPb.Currency =>
  currency === 'NGN' ? PaymentsPb.Currency.NGN : PaymentsPb.Currency.USD

const toProtoStatus = (
  status: 'pending' | 'processing' | 'completed' | 'failed',
): PaymentsPb.PaymentStatus => {
  switch (status) {
    case 'pending':
      return PaymentsPb.PaymentStatus.PENDING
    case 'processing':
      return PaymentsPb.PaymentStatus.PROCESSING
    case 'completed':
      return PaymentsPb.PaymentStatus.COMPLETED
    case 'failed':
      return PaymentsPb.PaymentStatus.FAILED
    default:
      throw new ConnectError('Invalid status', Code.InvalidArgument)
  }
}

const toProtoType = (type: 'deposit' | 'withdrawal'): PaymentsPb.PaymentType =>
  type === 'deposit'
    ? PaymentsPb.PaymentType.DEPOSIT
    : PaymentsPb.PaymentType.WITHDRAWAL

const toProtoPayment = (payment: Payment) => ({
  paymentId: payment.id,
  userId: payment.userId,
  amount: payment.amount,
  currency: toProtoCurrency(payment.currency),
  status: toProtoStatus(payment.status),
  type: toProtoType(payment.type),
  reference: payment.reference,
  createdAt: payment.createdAt.toISOString(),
})

// --- Routes ---

export const paymentsRoutes = (router: ConnectRouter) =>
  /* biome-ignore lint/suspicious/noExplicitAny: router.service UnaryImpl is
   * incompatible with protobuf-es v2 branded message types ($typeName brand).
   * Casting at the boundary so handler internals remain fully type-safe.
   * Track: github.com/connectrpc/connect-es/issues for v2.x resolution.
   */
  (router.service as any)(PaymentsPb.PaymentsService, {
    /*
     * Request parameters use MessageShape<typeof Schema> explicitly because
     * @connectrpc/connect's UnaryImpl passes Message<string> as the base type,
     * breaking inference of specific proto message types. MessageShape resolves
     * to the same type as the generated message alias — not a cast.
     */
    createDepositIntent: (
      req: MessageShape<typeof PaymentsPb.CreateDepositIntentRequestSchema>,
    ) =>
      runHandler(
        payments
          .createDepositIntent({
            userId: req.userId,
            amount: req.amount,
            currency: toDbCurrency(req.currency),
            email: req.email,
          })
          .pipe(
            Effect.map((payment) => ({
              paymentId: payment.id,
              paymentUrl: payment.paymentUrl ?? '',
              reference: payment.reference,
            })),
            Effect.catchTags({
              InfrastructureError: () => internalError,
            }),
          ),
      ),

    createWithdrawIntent: (
      req: MessageShape<typeof PaymentsPb.CreateWithdrawIntentRequestSchema>,
    ) =>
      runHandler(
        payments
          .createWithdrawIntent({
            userId: req.userId,
            amount: req.amount,
            currency: toDbCurrency(req.currency),
            bankCode: req.bankCode,
            accountNumber: req.accountNumber,
          })
          .pipe(
            Effect.map((payment) => ({
              paymentId: payment.id,
              reference: payment.reference,
            })),
            Effect.catchTags({
              InfrastructureError: () => internalError,
            }),
          ),
      ),

    getPaymentStatus: (
      req: MessageShape<typeof PaymentsPb.GetPaymentStatusRequestSchema>,
    ) =>
      runHandler(
        payments.getPaymentStatus(req.paymentId, req.userId).pipe(
          Effect.map((payment) => ({
            payment: toProtoPayment(payment),
          })),
          Effect.catchTags({
            PaymentNotFoundError: () =>
              fail('Payment not found', Code.NotFound),
            InfrastructureError: () => internalError,
          }),
        ),
      ),

    listPayments: (
      req: MessageShape<typeof PaymentsPb.ListPaymentsRequestSchema>,
    ) =>
      runHandler(
        payments
          .listPayments({
            userId: req.userId,
            page: req.page || 1,
            pageSize: req.pageSize || 20,
          })
          .pipe(
            Effect.map((userPayments) => ({
              payments: userPayments.map(toProtoPayment),
              total: userPayments.length,
            })),
            Effect.catchTags({
              InfrastructureError: () => internalError,
            }),
          ),
      ),
  })

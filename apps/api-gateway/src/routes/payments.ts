import { Code, ConnectError } from '@connectrpc/connect'
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform'
import { PaymentsPb } from '@org/protos'
import { Effect } from 'effect'
import { PaymentsClient } from '../grpc/clients/payments.js'
import { requireAuth } from '../middleware/auth.js'
import {
  DepositIntentBodySchema,
  WithdrawIntentBodySchema,
} from '../schemas/payments.js'

const grpcToHttp: Record<number, number> = {
  [Code.AlreadyExists]: 409,
  [Code.NotFound]: 404,
  [Code.Unauthenticated]: 401,
  [Code.InvalidArgument]: 400,
  [Code.Internal]: 500,
}

const toConnectError = (e: unknown): ConnectError =>
  e instanceof ConnectError
    ? e
    : new ConnectError('Internal server error', Code.Internal)

const grpcErrorResponse = (e: unknown) =>
  HttpServerResponse.json(
    { error: toConnectError(e).rawMessage },
    { status: grpcToHttp[toConnectError(e).code] ?? 500 },
  )

const toProtoCurrency = (currency: 'NGN' | 'USD'): PaymentsPb.Currency =>
  currency === 'NGN' ? PaymentsPb.Currency.NGN : PaymentsPb.Currency.USD

export const paymentsRoutes = HttpRouter.empty.pipe(
  HttpRouter.post(
    '/payments/deposit',
    Effect.flatMap(requireAuth, (user) =>
      Effect.flatMap(
        HttpServerRequest.schemaBodyJson(DepositIntentBodySchema),
        (body) =>
          Effect.flatMap(PaymentsClient, (client) =>
            Effect.tryPromise<
              PaymentsPb.CreateDepositIntentResponse,
              ConnectError
            >({
              try: () =>
                client.createDepositIntent({
                  userId: user.userId,
                  amount: body.amount,
                  currency: toProtoCurrency(body.currency),
                  email: user.email,
                }),
              catch: toConnectError,
            }),
          ),
      ),
    ).pipe(
      Effect.tapError((e) => Effect.logError('deposit error', e)),
      Effect.flatMap((response) =>
        HttpServerResponse.json(response, { status: 201 }),
      ),
      Effect.catchTag('ParseError', (e) =>
        HttpServerResponse.json(
          { error: 'Validation failed', details: e.message },
          { status: 400 },
        ),
      ),
      Effect.catchTag('UnauthorizedError', (e) =>
        HttpServerResponse.json({ error: e.reason }, { status: 401 }),
      ),
      Effect.catchAll(grpcErrorResponse),
    ),
  ),

  HttpRouter.post(
    '/payments/withdraw',
    Effect.flatMap(requireAuth, (user) =>
      Effect.flatMap(
        HttpServerRequest.schemaBodyJson(WithdrawIntentBodySchema),
        (body) =>
          Effect.flatMap(PaymentsClient, (client) =>
            Effect.tryPromise<
              PaymentsPb.CreateWithdrawIntentResponse,
              ConnectError
            >({
              try: () =>
                client.createWithdrawIntent({
                  userId: user.userId,
                  amount: body.amount,
                  currency: toProtoCurrency(body.currency),
                  bankCode: body.bankCode,
                  accountNumber: body.accountNumber,
                }),
              catch: toConnectError,
            }),
          ),
      ),
    ).pipe(
      Effect.flatMap((response) =>
        HttpServerResponse.json(response, { status: 201 }),
      ),
      Effect.catchTag('ParseError', (e) =>
        HttpServerResponse.json(
          { error: 'Validation failed', details: e.message },
          { status: 400 },
        ),
      ),
      Effect.catchTag('UnauthorizedError', (e) =>
        HttpServerResponse.json({ error: e.reason }, { status: 401 }),
      ),
      Effect.catchAll(grpcErrorResponse),
    ),
  ),

  HttpRouter.get(
    '/payments/:paymentId',
    Effect.flatMap(requireAuth, (user) =>
      Effect.flatMap(HttpRouter.params, (params) =>
        Effect.flatMap(PaymentsClient, (client) =>
          Effect.tryPromise<PaymentsPb.GetPaymentStatusResponse, ConnectError>({
            try: () =>
              client.getPaymentStatus({
                paymentId: params.paymentId,
                userId: user.userId,
              }),
            catch: toConnectError,
          }),
        ),
      ),
    ).pipe(
      Effect.flatMap((response) => HttpServerResponse.json(response)),
      Effect.catchTag('UnauthorizedError', (e) =>
        HttpServerResponse.json({ error: e.reason }, { status: 401 }),
      ),
      Effect.catchAll(grpcErrorResponse),
    ),
  ),

  HttpRouter.get(
    '/payments',
    Effect.flatMap(requireAuth, (user) =>
      Effect.flatMap(PaymentsClient, (client) =>
        Effect.tryPromise<PaymentsPb.ListPaymentsResponse, ConnectError>({
          try: () =>
            client.listPayments({
              userId: user.userId,
              page: 1,
              pageSize: 20,
            }),
          catch: toConnectError,
        }),
      ),
    ).pipe(
      Effect.flatMap((response) =>
        HttpServerResponse.json({
          payments: response.payments,
          total: response.total,
        }),
      ),
      Effect.catchTag('UnauthorizedError', (e) =>
        HttpServerResponse.json({ error: e.reason }, { status: 401 }),
      ),
      Effect.catchAll(grpcErrorResponse),
    ),
  ),
)

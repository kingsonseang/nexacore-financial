import { Code, ConnectError } from '@connectrpc/connect'
import { HttpRouter, HttpServerResponse } from '@effect/platform'
import { AccountsPb } from '@org/protos'
import { Effect } from 'effect'
import { AccountsClient } from '../grpc/clients/accounts.js'
import { requireAuth } from '../middleware/auth.js'

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

export const accountsRoutes = HttpRouter.empty.pipe(
  HttpRouter.post(
    '/accounts',
    Effect.flatMap(requireAuth, (user) =>
      Effect.flatMap(AccountsClient, (client) =>
        Effect.tryPromise<AccountsPb.CreateAccountResponse, ConnectError>({
          try: () =>
            client.createAccount({
              userId: user.userId,
            }),
          catch: toConnectError,
        }),
      ),
    ).pipe(
      Effect.flatMap((response) =>
        HttpServerResponse.json(response, { status: 201 }),
      ),
      Effect.catchTag('UnauthorizedError', (e) =>
        HttpServerResponse.json({ error: e.reason }, { status: 401 }),
      ),
      Effect.catchAll(grpcErrorResponse),
    ),
  ),

  HttpRouter.get(
    '/accounts',
    Effect.flatMap(requireAuth, (user) =>
      Effect.flatMap(AccountsClient, (client) =>
        Effect.tryPromise<AccountsPb.GetAccountResponse, ConnectError>({
          try: () =>
            client.getAccount({
              userId: user.userId,
            }),
          catch: toConnectError,
        }),
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
    '/accounts/balance/:currency',
    Effect.flatMap(requireAuth, (user) =>
      Effect.flatMap(HttpRouter.params, (params) =>
        Effect.flatMap(AccountsClient, (client) => {
          const currency =
            params.currency === 'usd'
              ? AccountsPb.Currency.USD
              : AccountsPb.Currency.NGN

          return Effect.tryPromise<AccountsPb.GetBalanceResponse, ConnectError>(
            {
              try: () =>
                client.getBalance({
                  userId: user.userId,
                  currency,
                }),
              catch: toConnectError,
            },
          )
        }),
      ),
    ).pipe(
      Effect.flatMap((response) => HttpServerResponse.json(response)),
      Effect.catchTag('UnauthorizedError', (e) =>
        HttpServerResponse.json({ error: e.reason }, { status: 401 }),
      ),
      Effect.catchAll(grpcErrorResponse),
    ),
  ),
)

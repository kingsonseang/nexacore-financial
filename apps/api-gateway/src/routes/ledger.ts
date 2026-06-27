import { Code, ConnectError } from '@connectrpc/connect'
import { HttpRouter, HttpServerResponse } from '@effect/platform'
import { LedgerPb } from '@org/protos'
import { Effect } from 'effect'
import { LedgerClient } from '../grpc/clients/ledger.js'
import { requireAuth } from '../middleware/auth.js'

const grpcToHttp: Record<number, number> = {
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

const toCurrencyLabel = (c: LedgerPb.Currency): 'NGN' | 'USD' =>
  c === LedgerPb.Currency.USD ? 'USD' : 'NGN'

const toEntryTypeLabel = (t: LedgerPb.EntryType): 'debit' | 'credit' =>
  t === LedgerPb.EntryType.CREDIT ? 'credit' : 'debit'

const toEntryDto = (entry: LedgerPb.JournalEntry) => ({
  entryId: entry.entryId,
  accountId: entry.accountId,
  type: toEntryTypeLabel(entry.type),
  amount: entry.amount,
  currency: toCurrencyLabel(entry.currency),
  reference: entry.reference,
  description: entry.description,
  createdAt: entry.createdAt,
})

export const ledgerRoutes = HttpRouter.empty.pipe(
  HttpRouter.get(
    '/ledger/balance/:currency',
    Effect.flatMap(requireAuth, (user) =>
      Effect.flatMap(HttpRouter.params, (params) =>
        Effect.flatMap(LedgerClient, (client) => {
          const currency =
            params.currency?.toLowerCase() === 'usd'
              ? LedgerPb.Currency.USD
              : LedgerPb.Currency.NGN

          return Effect.tryPromise<LedgerPb.GetBalanceResponse, ConnectError>({
            try: () =>
              client.getBalance({
                accountId: user.userId,
                currency,
              }) as Promise<LedgerPb.GetBalanceResponse>,
            catch: toConnectError,
          })
        }),
      ),
    ).pipe(
      Effect.flatMap((response) =>
        HttpServerResponse.json({
          balance: response.balance,
          currency: toCurrencyLabel(response.currency),
          accountId: response.accountId,
        }),
      ),
      Effect.catchTag('UnauthorizedError', (e) =>
        HttpServerResponse.json({ error: e.reason }, { status: 401 }),
      ),
      Effect.catchAll(grpcErrorResponse),
    ),
  ),

  HttpRouter.get(
    '/ledger/entries',
    Effect.flatMap(requireAuth, (user) =>
      Effect.flatMap(LedgerClient, (client) =>
        Effect.tryPromise<LedgerPb.ListEntriesResponse, ConnectError>({
          try: () =>
            client.listEntries({
              accountId: user.userId,
              page: 1,
              pageSize: 20,
            }) as Promise<LedgerPb.ListEntriesResponse>,
          catch: toConnectError,
        }),
      ),
    ).pipe(
      Effect.flatMap((response) =>
        HttpServerResponse.json({
          entries: response.entries.map(toEntryDto),
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

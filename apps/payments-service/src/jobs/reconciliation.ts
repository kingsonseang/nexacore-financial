import type { ProviderRegistry } from '@org/payment-providers'
import { Effect, Schedule } from 'effect'
import type { DrizzleDB } from '../db/client.js'
import type { LedgerClient } from '../grpc/clients/ledger.js'
import * as payments from '../services/payments.js'

/*
 * Runs reconcilePayments on a fixed interval as a safeguard against the
 * known gap where a webhook's DB status update succeeds but the subsequent
 * ledger PostEntry call fails (network blip, ledger-service briefly down).
 * 5 minutes is a starting point, not a tuned value — adjust based on how
 * quickly a missing-ledger-entry gap needs to be caught in practice.
 */
export const reconciliationLoop: Effect.Effect<
  void,
  never,
  DrizzleDB | LedgerClient | ProviderRegistry
> = Effect.gen(function* () {
  yield* Effect.logInfo('Running scheduled payment reconciliation')

  const results = yield* payments
    .reconcilePayments()
    .pipe(
      Effect.catchAll((e) =>
        Effect.logError('Reconciliation run failed', e).pipe(Effect.as([])),
      ),
    )

  const posted = results.filter((r) => r.action === 'posted')
  if (posted.length > 0) {
    yield* Effect.logWarning(
      `Reconciliation posted ${posted.length} missing ledger entries`,
      posted,
    )
  }
}).pipe(Effect.repeat(Schedule.fixed('5 minutes')))

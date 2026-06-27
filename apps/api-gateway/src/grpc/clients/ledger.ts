import { createClient } from '@connectrpc/connect'
import { createGrpcTransport } from '@connectrpc/connect-node'
import { LedgerPb } from '@org/protos'
import { Context, Effect, Layer } from 'effect'
import { AppConfig } from '../../config/index.js'

export type LedgerClient = ReturnType<
  typeof createClient<typeof LedgerPb.LedgerService>
>

export const LedgerClient = Context.GenericTag<LedgerClient>(
  '@nexacore/gateway/LedgerClient',
)

export const LedgerClientLive = Layer.effect(
  LedgerClient,
  Effect.gen(function* () {
    const url = yield* AppConfig.services.ledgerServiceUrl

    const transport = createGrpcTransport({
      baseUrl: url,
    })

    return createClient(LedgerPb.LedgerService, transport)
  }),
)

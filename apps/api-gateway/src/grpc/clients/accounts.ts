import { createClient } from '@connectrpc/connect'
import { createGrpcTransport } from '@connectrpc/connect-node'
import { AccountsPb } from '@org/protos'
import { Context, Effect, Layer } from 'effect'
import { AppConfig } from '../../config/index.js'

export type AccountsClient = ReturnType<
  typeof createClient<typeof AccountsPb.AccountsService>
>

export const AccountsClient = Context.GenericTag<AccountsClient>(
  '@nexacore/gateway/AccountsClient',
)

export const AccountsClientLive = Layer.effect(
  AccountsClient,
  Effect.gen(function* () {
    const url = yield* AppConfig.services.accountsServiceUrl

    const transport = createGrpcTransport({
      baseUrl: url,
    })

    return createClient(AccountsPb.AccountsService, transport)
  }),
)

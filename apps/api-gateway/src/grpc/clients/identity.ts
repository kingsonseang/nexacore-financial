import { createClient } from '@connectrpc/connect'
import { createGrpcTransport } from '@connectrpc/connect-node'
import { IdentityPb } from '@org/protos'
import { Context, Effect, Layer } from 'effect'
import { AppConfig } from '../../config/index.js'

export type IdentityClient = ReturnType<
  typeof createClient<typeof IdentityPb.IdentityService>
>

export const IdentityClient = Context.GenericTag<IdentityClient>(
  '@nexacore/gateway/IdentityClient',
)

export const IdentityClientLive = Layer.effect(
  IdentityClient,
  Effect.gen(function* () {
    const url = yield* AppConfig.services.identityServiceUrl

    const transport = createGrpcTransport({
      baseUrl: url,
    })

    return createClient(IdentityPb.IdentityService, transport)
  }),
)

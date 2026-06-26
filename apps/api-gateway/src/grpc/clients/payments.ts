import { createClient } from '@connectrpc/connect'
import { createGrpcTransport } from '@connectrpc/connect-node'
import { PaymentsPb } from '@org/protos'
import { Context, Effect, Layer } from 'effect'
import { AppConfig } from '../../config/index.js'

export type PaymentsClient = ReturnType<
  typeof createClient<typeof PaymentsPb.PaymentsService>
>

export const PaymentsClient = Context.GenericTag<PaymentsClient>(
  '@nexacore/gateway/PaymentsClient',
)

export const PaymentsClientLive = Layer.effect(
  PaymentsClient,
  Effect.gen(function* () {
    const url = yield* AppConfig.services.paymentsServiceUrl
    const transport = createGrpcTransport({ baseUrl: url })
    return createClient(PaymentsPb.PaymentsService, transport)
  }),
)

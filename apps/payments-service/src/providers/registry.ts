import {
  createProviderRegistry,
  type ProviderRegistry,
} from '@org/payment-providers'
import { Context, Effect, Layer } from 'effect'
import { AppConfig } from '../config/index.js'

export const ProviderRegistryService = Context.GenericTag<ProviderRegistry>(
  '@nexacore/payments/ProviderRegistry',
)

export const ProviderRegistryLive = Layer.effect(
  ProviderRegistryService,
  Effect.gen(function* () {
    const paystackSecretKey = yield* AppConfig.paystack.secretKey
    return createProviderRegistry({ paystackSecretKey })
  }),
)

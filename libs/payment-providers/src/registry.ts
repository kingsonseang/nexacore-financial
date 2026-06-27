import { mockUsdProvider } from './mock/provider.js'
import { createPaystackProvider } from './paystack/provider.js'
import type { PaymentProvider } from './types.js'

export const createProviderRegistry = (config: {
  paystackSecretKey: string
}) => {
  const paystack = createPaystackProvider(config.paystackSecretKey)

  const providerFor = (currency: 'NGN' | 'USD'): PaymentProvider =>
    currency === 'NGN' ? paystack : mockUsdProvider

  return { providerFor }
}

export type ProviderRegistry = ReturnType<typeof createProviderRegistry>

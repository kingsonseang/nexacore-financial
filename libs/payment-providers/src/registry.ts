import { mockUsdProvider } from './mock/provider.js'
import { createPaystackProvider } from './paystack/provider.js'
import type { PaymentProvider } from './types.js'

export const createProviderRegistry = (config: {
  paystackSecretKey: string
}) => {
  const paystack = createPaystackProvider(config.paystackSecretKey)

  const providerFor = (currency: 'NGN' | 'USD'): PaymentProvider =>
    currency === 'NGN' ? paystack : mockUsdProvider

  const providerByName = (name: string): PaymentProvider | undefined => {
    if (name === 'paystack') {
      return paystack
    }
    if (name === mockUsdProvider.name) {
      return mockUsdProvider
    }
    return
  }

  return { providerFor, providerByName }
}

export type ProviderRegistry = ReturnType<typeof createProviderRegistry>

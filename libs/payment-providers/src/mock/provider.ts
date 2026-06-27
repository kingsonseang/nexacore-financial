import { Effect } from 'effect'
import type { PaymentProvider } from '../types.js'

/*
 * Stand-in for Stripe, which has not been integrated yet. USD deposits route
 * here so the request flow and response shape stay consistent (real
 * paymentUrl/reference fields) without depending on a live Stripe account.
 * Replace with a real createStripeProvider() once Stripe integration begins.
 */
export const mockUsdProvider: PaymentProvider = {
  name: 'mock-stripe',

  initializeDeposit: (params) =>
    Effect.succeed({
      paymentUrl: `https://checkout.stripe.com/mock/${params.reference}`,
      providerReference: params.reference,
    }),

  verifyDeposit: (reference) =>
    Effect.succeed({
      status: 'pending' as const,
      amountMinorUnits: 0,
      providerReference: reference,
    }),
}

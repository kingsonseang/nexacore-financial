import { Effect } from 'effect'
import type { InitializeDepositParams, PaymentProvider } from '../types.js'
import * as paystackClient from './client.js'

const toDepositStatus = (status: string): 'success' | 'failed' | 'pending' => {
  switch (status) {
    case 'success':
      return 'success'
    case 'failed':
      return 'failed'
    default:
      return 'pending'
  }
}

export const createPaystackProvider = (secretKey: string): PaymentProvider => ({
  name: 'paystack',

  initializeDeposit: (params: InitializeDepositParams) =>
    paystackClient
      .initializeTransaction(secretKey, {
        email: params.email,
        amount: params.amountMinorUnits,
        reference: params.reference,
      })
      .pipe(
        Effect.map((response) => ({
          paymentUrl: response.data.authorization_url,
          providerReference: response.data.reference,
        })),
      ),

  verifyDeposit: (reference: string) =>
    paystackClient.verifyTransaction(secretKey, reference).pipe(
      Effect.map((response) => ({
        status: toDepositStatus(response.data.status),
        amountMinorUnits: response.data.amount,
        providerReference: response.data.reference,
      })),
    ),
})

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

import { createHmac, timingSafeEqual } from 'node:crypto'
import { Effect } from 'effect'
import type {
  InitializeDepositParams,
  PaymentProvider,
  WebhookEvent,
} from '../types.js'
import * as paystackClient from './client.js'

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

  /*
   * Per Paystack's webhook spec: signature = HMAC-SHA512(rawBody, secretKey)
   * hex digest, sent in the x-paystack-signature header. Comparison uses
   * timingSafeEqual to avoid leaking signature validity via response timing.
   * Worth re-checking against current Paystack docs if this ever fails
   * unexpectedly, as webhook signing details can change between API versions.
   */
  verifyWebhookSignature: (rawBody: string, signature: string): boolean => {
    const expected = createHmac('sha512', secretKey)
      .update(rawBody)
      .digest('hex')
    const expectedBuf = Buffer.from(expected, 'hex')
    const signatureBuf = Buffer.from(signature, 'hex')

    if (expectedBuf.length !== signatureBuf.length) {
      return false
    }
    return timingSafeEqual(expectedBuf, signatureBuf)
  },

  parseWebhookEvent: (rawBody: string): WebhookEvent | null => {
    const body = JSON.parse(rawBody) as {
      event: string
      data: { reference: string; amount: number }
    }

    if (body.event === 'charge.success') {
      return {
        type: 'deposit_success',
        reference: body.data.reference,
        amountMinorUnits: body.data.amount,
      }
    }

    if (body.event === 'charge.failed') {
      return {
        type: 'deposit_failed',
        reference: body.data.reference,
        amountMinorUnits: body.data.amount,
      }
    }

    return null
  },
})

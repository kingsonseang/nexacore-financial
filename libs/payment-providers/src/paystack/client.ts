import { Effect } from 'effect'
import { ProviderError } from '../types.js'

const PAYSTACK_BASE_URL = 'https://api.paystack.co'

interface PaystackInitializeResponse {
  data: {
    authorization_url: string
    access_code: string
    reference: string
  }
  message: string
  status: boolean
}

interface PaystackVerifyResponse {
  data: {
    status: string
    amount: number
    reference: string
  }
  message: string
  status: boolean
}

const paystackFetch = <T>(
  secretKey: string,
  path: string,
  init?: RequestInit,
): Effect.Effect<T, ProviderError> =>
  Effect.tryPromise({
    try: async () => {
      const res = await fetch(`${PAYSTACK_BASE_URL}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
          ...init?.headers,
        },
      })

      const raw: unknown = await res.json()

      // Narrow to the Paystack envelope
      if (
        !raw ||
        typeof raw !== 'object' ||
        !('status' in raw) ||
        typeof raw.status !== 'boolean'
      ) {
        throw new Error(
          `Invalid Paystack response: ${res.status} ${res.statusText}`,
        )
      }

      const body = raw as { status: boolean; message?: string; data?: unknown }

      if (!res.ok || body.status === false) {
        throw new Error(
          body.message ?? `Paystack request failed: ${res.status}`,
        )
      }

      return body as T
    },
    catch: (cause) =>
      new ProviderError({
        provider: 'paystack',
        message:
          cause instanceof Error ? cause.message : 'Unknown Paystack error',
        cause,
      }),
  })

export const initializeTransaction = (
  secretKey: string,
  params: { email: string; amount: number; reference: string },
) =>
  paystackFetch<PaystackInitializeResponse>(
    secretKey,
    '/transaction/initialize',
    {
      method: 'POST',
      body: JSON.stringify(params),
    },
  )

export const verifyTransaction = (secretKey: string, reference: string) =>
  paystackFetch<PaystackVerifyResponse>(
    secretKey,
    `/transaction/verify/${encodeURIComponent(reference)}`,
  )

import { Data, type Effect } from 'effect'

export class ProviderError extends Data.TaggedError('ProviderError')<{
  provider: string
  message: string
  cause?: unknown
}> {}

export interface InitializeDepositParams {
  amountMinorUnits: number
  email: string
  reference: string
}

export interface InitializeDepositResult {
  paymentUrl: string
  providerReference: string
}

export interface VerifyDepositResult {
  amountMinorUnits: number
  providerReference: string
  status: 'success' | 'failed' | 'pending'
}

export interface PaymentProvider {
  initializeDeposit: (
    params: InitializeDepositParams,
  ) => Effect.Effect<InitializeDepositResult, ProviderError>
  readonly name: string
  verifyDeposit: (
    reference: string,
  ) => Effect.Effect<VerifyDepositResult, ProviderError>
}

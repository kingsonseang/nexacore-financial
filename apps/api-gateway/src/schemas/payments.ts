import { Schema } from 'effect'

export const DepositIntentBodySchema = Schema.Struct({
  amount: Schema.String,
  currency: Schema.Literal('NGN', 'USD'),
})

export const WithdrawIntentBodySchema = Schema.Struct({
  amount: Schema.String,
  currency: Schema.Literal('NGN', 'USD'),
  bankCode: Schema.String,
  accountNumber: Schema.String,
})

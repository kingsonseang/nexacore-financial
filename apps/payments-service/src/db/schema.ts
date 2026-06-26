import {
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'

export const currencyEnum = pgEnum('currency', ['NGN', 'USD'])

export const paymentStatusEnum = pgEnum('payment_status', [
  'pending',
  'processing',
  'completed',
  'failed',
])

export const paymentTypeEnum = pgEnum('payment_type', ['deposit', 'withdrawal'])

export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    amount: numeric('amount', { precision: 20, scale: 2 }).notNull(),
    currency: currencyEnum('currency').notNull(),
    status: paymentStatusEnum('status').notNull().default('pending'),
    type: paymentTypeEnum('type').notNull(),
    reference: text('reference').notNull().unique(),
    /*
     * paymentUrl, bankCode, and accountNumber are nullable since they only
     * apply to one payment type (deposit gets paymentUrl, withdrawal gets
     * bankCode/accountNumber). Revisit if a cleaner discriminated shape is
     * needed once a real provider (Paystack) is wired in.
     */
    paymentUrl: text('payment_url'),
    bankCode: text('bank_code'),
    accountNumber: text('account_number'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('payments_user_id_idx').on(table.userId),
    index('payments_reference_idx').on(table.reference),
  ],
)

export type Payment = typeof payments.$inferSelect
export type NewPayment = typeof payments.$inferInsert
export type CurrencyEnum = (typeof currencyEnum.enumValues)[number]
export type PaymentStatusEnum = (typeof paymentStatusEnum.enumValues)[number]
export type PaymentTypeEnum = (typeof paymentTypeEnum.enumValues)[number]

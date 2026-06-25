import {
  index,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

export const currencyEnum = pgEnum('currency', ['NGN', 'USD'])

export const wallets = pgTable(
  'wallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    currency: currencyEnum('currency').notNull(),
    balance: numeric('balance', { precision: 20, scale: 2 })
      .notNull()
      .default('0'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('wallets_user_id_idx').on(table.userId),
    uniqueIndex('wallets_user_currency_idx').on(table.userId, table.currency),
  ],
)

export type Wallet = typeof wallets.$inferSelect
export type NewWallet = typeof wallets.$inferInsert

export type CurrencyEnum = (typeof currencyEnum.enumValues)[number]

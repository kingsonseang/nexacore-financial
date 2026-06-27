CREATE TYPE entry_type AS ENUM ('debit', 'credit');

CREATE TABLE journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    entry_type entry_type NOT NULL,
    amount NUMERIC(20, 2) NOT NULL,
    currency TEXT NOT NULL,
    reference TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_journal_entries_account_id ON journal_entries (account_id);
CREATE INDEX idx_journal_entries_reference ON journal_entries (reference);

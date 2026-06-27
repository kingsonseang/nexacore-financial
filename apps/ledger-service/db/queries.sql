-- name: PostEntry :one
INSERT INTO journal_entries (account_id, entry_type, amount, currency, reference, description)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetBalance :one
SELECT
    COALESCE(SUM(CASE WHEN entry_type = 'credit' THEN amount ELSE -amount END), 0)::NUMERIC AS balance
FROM journal_entries
WHERE account_id = $1 AND currency = $2;

-- name: ListEntries :many
SELECT * FROM journal_entries
WHERE account_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetEntryByReference :one
SELECT * FROM journal_entries WHERE reference = $1 LIMIT 1;

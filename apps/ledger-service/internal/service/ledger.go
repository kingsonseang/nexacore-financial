package service

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	db "github.com/kingsonseang/nexacore-financial/ledger-service/gen/db"
	dbtypes "github.com/kingsonseang/nexacore-financial/ledger-service/internal/dbtypes"
)

type LedgerService struct {
	queries *db.Queries
}

func NewLedgerService(pool *pgxpool.Pool) *LedgerService {
	return &LedgerService{
		queries: db.New(pool),
	}
}

func (s *LedgerService) PostEntry(
	ctx context.Context,
	accountID string,
	entryType db.EntryType,
	amount string,
	currency string,
	reference string,
	description string,
) (db.JournalEntry, error) {
	accountUUID, err := dbtypes.UUIDFromString(accountID)
	if err != nil {
		return db.JournalEntry{}, fmt.Errorf("post entry: invalid accountID: %w", err)
	}

	amt, err := dbtypes.NumericFromString(amount)
	if err != nil {
		return db.JournalEntry{}, fmt.Errorf("post entry: invalid amount: %w", err)
	}

	entry, err := s.queries.PostEntry(ctx, db.PostEntryParams{
		AccountID:   accountUUID,
		EntryType:   entryType,
		Amount:      amt,
		Currency:    currency,
		Reference:   reference,
		Description: dbtypes.TextFromString(description),
	})
	if err != nil {
		return db.JournalEntry{}, fmt.Errorf("post entry: %w", err)
	}
	return entry, nil
}

func (s *LedgerService) GetBalance(
	ctx context.Context,
	accountID string,
	currency string,
) (string, error) {
	accountUUID, err := dbtypes.UUIDFromString(accountID)
	if err != nil {
		return "", fmt.Errorf("get balance: invalid accountID: %w", err)
	}

	balance, err := s.queries.GetBalance(ctx, db.GetBalanceParams{
		AccountID: accountUUID,
		Currency:  currency,
	})
	if err != nil {
		return "", fmt.Errorf("get balance: %w", err)
	}

	balanceStr, err := dbtypes.NumericToString(balance)
	if err != nil {
		return "", fmt.Errorf("get balance: failed to convert numeric: %w", err)
	}
	return balanceStr, nil
}

func (s *LedgerService) ListEntries(
	ctx context.Context,
	accountID string,
	limit int32,
	offset int32,
) ([]db.JournalEntry, error) {
	accountUUID, err := dbtypes.UUIDFromString(accountID)
	if err != nil {
		return nil, fmt.Errorf("list entries: invalid accountID: %w", err)
	}

	entries, err := s.queries.ListEntries(ctx, db.ListEntriesParams{
		AccountID: accountUUID,
		Limit:     limit,
		Offset:    offset,
	})
	if err != nil {
		return nil, fmt.Errorf("list entries: %w", err)
	}
	return entries, nil
}

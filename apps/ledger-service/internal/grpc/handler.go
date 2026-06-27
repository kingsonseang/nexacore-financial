package grpc

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"

	db "github.com/kingsonseang/nexacore-financial/ledger-service/gen/db"
	ledgerv1 "github.com/kingsonseang/nexacore-financial/ledger-service/gen/nexacore/ledger/v1"
	dbtypes "github.com/kingsonseang/nexacore-financial/ledger-service/internal/dbtypes"
	"github.com/kingsonseang/nexacore-financial/ledger-service/internal/service"
)

type Handler struct {
	ledgerv1.UnimplementedLedgerServiceServer
	ledger *service.LedgerService
}

// --- grpc helpers ---

func toDbCurrency(c ledgerv1.Currency) (string, error) {
	switch c {
	case ledgerv1.Currency_CURRENCY_NGN:
		return "NGN", nil
	case ledgerv1.Currency_CURRENCY_USD:
		return "USD", nil
	default:
		return "", status.Error(codes.InvalidArgument, "currency must be specified")
	}
}

func toProtoCurrency(c string) ledgerv1.Currency {
	if c == "USD" {
		return ledgerv1.Currency_CURRENCY_USD
	}
	return ledgerv1.Currency_CURRENCY_NGN
}

func NewHandler(ledger *service.LedgerService) *Handler {
	return &Handler{ledger: ledger}
}

func toDbEntryType(t ledgerv1.EntryType) db.EntryType {
	if t == ledgerv1.EntryType_ENTRY_TYPE_CREDIT {
		return db.EntryTypeCredit
	}
	return db.EntryTypeDebit
}

func toProtoEntryType(t db.EntryType) ledgerv1.EntryType {
	if t == db.EntryTypeCredit {
		return ledgerv1.EntryType_ENTRY_TYPE_CREDIT
	}
	return ledgerv1.EntryType_ENTRY_TYPE_DEBIT
}

// --- Routes ---

func (h *Handler) PostEntry(
	ctx context.Context,
	req *ledgerv1.PostEntryRequest,
) (*ledgerv1.PostEntryResponse, error) {
	currency, err := toDbCurrency(req.Currency)
	if err != nil {
		return nil, err
	}

	entry, err := h.ledger.PostEntry(
		ctx,
		req.AccountId,
		toDbEntryType(req.Type),
		req.Amount,
		currency,
		req.Reference,
		req.Description,
	)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to post entry")
	}

	balanceAfter, err := h.ledger.GetBalance(ctx, req.AccountId, currency)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get balance after posting")
	}

	return &ledgerv1.PostEntryResponse{
		EntryId:      dbtypes.UUIDToString(entry.ID),
		BalanceAfter: balanceAfter,
	}, nil
}

func (h *Handler) GetBalance(
	ctx context.Context,
	req *ledgerv1.GetBalanceRequest,
) (*ledgerv1.GetBalanceResponse, error) {
	currency, err := toDbCurrency(req.Currency)
	if err != nil {
		return nil, err
	}

	balance, err := h.ledger.GetBalance(ctx, req.AccountId, currency)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get balance")
	}

	return &ledgerv1.GetBalanceResponse{
		Balance:   balance,
		Currency:  req.Currency,
		AccountId: req.AccountId,
	}, nil
}

func (h *Handler) ListEntries(
	ctx context.Context,
	req *ledgerv1.ListEntriesRequest,
) (*ledgerv1.ListEntriesResponse, error) {
	entries, err := h.ledger.ListEntries(ctx, req.AccountId, req.PageSize, (req.Page-1)*req.PageSize)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to list entries")
	}

	protoEntries := make([]*ledgerv1.JournalEntry, 0, len(entries))
	for _, e := range entries {
		amountStr, err := dbtypes.NumericToString(e.Amount)
		if err != nil {
			return nil, status.Error(codes.Internal, "failed to convert amount")
		}

		protoEntries = append(protoEntries, &ledgerv1.JournalEntry{
			EntryId:     dbtypes.UUIDToString(e.ID),
			AccountId:   dbtypes.UUIDToString(e.AccountID),
			Type:        toProtoEntryType(e.EntryType),
			Amount:      amountStr,
			Currency:    toProtoCurrency(e.Currency),
			Reference:   e.Reference,
			Description: dbtypes.TextToString(e.Description),
			CreatedAt:   e.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		})
	}

	return &ledgerv1.ListEntriesResponse{
		Entries: protoEntries,
		Total:   int32(len(protoEntries)),
	}, nil
}

func (h *Handler) GetEntryByReference(
	ctx context.Context,
	req *ledgerv1.GetEntryByReferenceRequest,
) (*ledgerv1.GetEntryByReferenceResponse, error) {
	entry, err := h.ledger.GetEntryByReference(ctx, req.Reference)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, status.Error(codes.NotFound, "entry not found")
		}
		return nil, status.Error(codes.Internal, "failed to get entry")
	}

	amountStr, err := dbtypes.NumericToString(entry.Amount)
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to convert amount")
	}

	return &ledgerv1.GetEntryByReferenceResponse{
		Entry: &ledgerv1.JournalEntry{
			EntryId:     dbtypes.UUIDToString(entry.ID),
			AccountId:   dbtypes.UUIDToString(entry.AccountID),
			Type:        toProtoEntryType(entry.EntryType),
			Amount:      amountStr,
			Currency:    toProtoCurrency(entry.Currency),
			Reference:   entry.Reference,
			Description: dbtypes.TextToString(entry.Description),
			CreatedAt:   entry.CreatedAt.Time.Format("2006-01-02T15:04:05Z07:00"),
		},
	}, nil
}

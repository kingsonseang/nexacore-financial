package dbtypes

import (
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
)

// UUIDFromString converts a string (e.g. "550e8400-e29b-41d4-a716-446655440000")
// into a pgtype.UUID suitable for sqlc/pgx queries.
func UUIDFromString(s string) (pgtype.UUID, error) {
	var u pgtype.UUID
	if err := u.Scan(s); err != nil {
		return pgtype.UUID{}, fmt.Errorf("dbtypes: invalid UUID %q: %w", s, err)
	}
	return u, nil
}

// UUIDToString converts pgtype.UUID to its canonical string representation.
func UUIDToString(u pgtype.UUID) string {
	// For most pgx setups, String() gives a usable textual representation [web:117].
	return u.String()
}

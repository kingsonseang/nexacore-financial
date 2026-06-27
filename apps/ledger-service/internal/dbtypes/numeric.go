package dbtypes

import (
	"fmt"

	"github.com/jackc/pgx/v5/pgtype"
)

// NumericFromString converts a decimal string into pgtype.Numeric.
// Example input: "123.45" or "0.0001".
func NumericFromString(s string) (pgtype.Numeric, error) {
	var n pgtype.Numeric
	if err := n.Scan(s); err != nil {
		return pgtype.Numeric{}, fmt.Errorf("dbtypes: invalid numeric %q: %w", s, err)
	}
	return n, nil
}

// NumericToString converts pgtype.Numeric back to a string representation.
// This is useful when your service return type is string.
func NumericToString(n pgtype.Numeric) (string, error) {
	// pgtype.Numeric.String() returns the textual form if Valid is true.
	if !n.Valid {
		return "", fmt.Errorf("dbtypes: numeric value is NULL")
	}
	return n.Int.String(), nil
}

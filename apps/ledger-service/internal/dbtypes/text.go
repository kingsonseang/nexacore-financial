package dbtypes

import "github.com/jackc/pgx/v5/pgtype"

// TextFromString converts a non-null description into pgtype.Text.
func TextFromString(s string) pgtype.Text {
	return pgtype.Text{
		String: s,
		Valid:  true,
	}
}

// TextFromPointer converts *string (nullable) into pgtype.Text.
func TextFromPointer(s *string) pgtype.Text {
	if s == nil {
		return pgtype.Text{
			String: "",
			Valid:  false,
		}
	}
	return pgtype.Text{
		String: *s,
		Valid:  true,
	}
}

// TextToString converts pgtype.Text to string, treating NULL as empty.
func TextToString(t pgtype.Text) string {
	if !t.Valid {
		return ""
	}
	return t.String
}

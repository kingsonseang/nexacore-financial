package main

import (
	"context"
	"log"
	"net"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
	googlegrpc "google.golang.org/grpc"

	ledgerv1 "github.com/kingsonseang/nexacore-financial/ledger-service/gen/nexacore/ledger/v1"
	ledgergrpc "github.com/kingsonseang/nexacore-financial/ledger-service/internal/grpc"
	"github.com/kingsonseang/nexacore-financial/ledger-service/internal/service"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, using existing environment")
	}

	ctx := context.Background()
	dbURL := os.Getenv("DATABASE_URL")
	pool, err := pgxpool.New(ctx, dbURL)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}
	defer pool.Close()

	port := os.Getenv("GRPC_PORT")
	if port == "" {
		port = "50054"
	}

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("failed to listen: %v", err)
	}

	grpcServer := googlegrpc.NewServer()

	ledgerService := service.NewLedgerService(pool)
	handler := ledgergrpc.NewHandler(ledgerService)
	ledgerv1.RegisterLedgerServiceServer(grpcServer, handler)

	log.Printf("Ledger service listening on :%s", port)
	if err := grpcServer.Serve(lis); err != nil {
		log.Fatalf("failed to serve: %v", err)
	}
}

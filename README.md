# NexaCore Financial

NexaCore Financial is a **multi-currency neobank + wealth intelligence platform** for self-directed investors. It focuses on NGN/USD cash management, portfolio tracking, AI-driven insights, and realistic money movement via Paystack.

The repository is a **polyglot Nx monorepo** with:

- TypeScript, Go, and Python backend services
- gRPC for internal service-to-service communication
- Redis Streams for event-driven workflows
- React microfrontends using Module Federation
- pnpm for dependency management
- Ultracite + Biome, commitlint, and Commitizen for developer workflow

---

## Architecture overview

### Backend services (planned)

- `api-gateway` (TypeScript)  
  Public REST API, authentication, routing to internal gRPC services.

- `identity-service` (TypeScript)  
  Users, auth, basic KYC profile.

- `accounts-service` (TypeScript)  
  NGN/USD wallets, balances, account metadata.

- `payments-service` (TypeScript)  
  Deposit/withdraw intents, Paystack integration, webhooks, payment status.

- `ledger-service` (Go)  
  Double-entry ledger with journal entries, postings, and balance queries.

- `market-data-service` (Python)  
  Fetches and caches stock and FX data from external market APIs.

- `insights-service` (Python)  
  AI-powered portfolio and cashflow insights, summaries, and alerts.

- `notification-service` (TypeScript)  
  Email / in-app notifications for funding, thresholds, and system events.

### Frontend apps

React + Module Federation (managed by Nx):

- `web-shell`  
  Host app providing layout, routing, and shared chrome.

- `mfe-dashboard`  
  Overview of balances, recent activity, and key metrics.

- `mfe-funding`  
  Funding flows via Paystack, deposit history, reconciliation status.

(Additional MFEs like `mfe-portfolio` and `mfe-insights` will be added later.)

### Data & infrastructure

- **Database:** Postgres (single instance, multiple schemas to start)  
- **Event bus:** Redis Streams for events such as payments, ledger postings, and notifications  
- **Containers:** Docker for local development (Kubernetes planned for later)  

---

## Tech stack

- **Workspace:** Nx, pnpm workspaces  
- **Languages:** TypeScript, Go, Python  
- **Backend:** Node (TS) + Go + Python, gRPC for internal calls  
- **Frontend:** React, Module Federation, Nx  
- **Payments:** Paystack (funding and reconciliation demo)  
- **Market data:** external stock/FX APIs (e.g., Marketstack, CurrencyLayer)  
- **Tooling:** Ultracite, Biome, commitlint, Commitizen (git-cz), Lefthook  

---

## Project layout (planned)

```txt
apps/
  api-gateway/
  identity-service/
  accounts-service/
  payments-service/
  ledger-service/          # Go
  market-data-service/     # Python
  insights-service/        # Python
  notification-service/
  web-shell/
  mfe-dashboard/
  mfe-funding/

libs/
  protos/                  # .proto files + generated clients
  shared-types/
  ui/
  api-client/

infra/
  docker/
  db/
  redis/
```

Nx projects will be wired to use pnpm and share tooling across the monorepo.

---

## Getting started

### Prerequisites

- Node 20+
- pnpm
- Docker & Docker Compose
- Go toolchain
- Python 3.x

### Install dependencies

```bash
pnpm install
```

### Run services (once project.json targets are defined)

Examples (these commands will evolve as services are generated and configured):

```bash
# Start core backend services
pnpm nx serve api-gateway
pnpm nx serve identity-service
pnpm nx serve accounts-service
pnpm nx serve payments-service

# Start frontend shell and microfrontends
pnpm nx serve web-shell
pnpm nx serve mfe-dashboard
pnpm nx serve mfe-funding
```

### Run infrastructure locally

From `infra/docker` (or repository root once the compose file is added):

```bash
docker compose up -d
```

This will spin up Postgres, Redis, and any other shared infrastructure used locally.

---

## Developer workflow

### Formatting & linting

- **Ultracite** orchestrates Biome and related tools across TS/JS/JSON/Python.
- Run manually:

```bash
pnpm ultracite fix
```

Git hooks (via Lefthook) will run Ultracite on staged files before commit.

### Commits

- Conventional Commits are enforced by commitlint.
- Commitizen (git-cz) is used for interactive commit messages:

```bash
pnpm commit
```

This opens an interactive prompt and generates a properly formatted commit message.

---

## Nx usage

Common Nx commands in this workspace:

```bash
# Visualize projects and dependencies
pnpm nx graph

# Run any target on a project
pnpm nx <target> <project>

# Examples (after apps are added)
pnpm nx build api-gateway
pnpm nx test accounts-service
```

Nx caches task outputs to speed up subsequent builds and tests and integrates with CI via Nx Cloud if configured.

---

## Roadmap (short term)

1. Configure core services:
   - `api-gateway`, `identity-service`, `accounts-service`, `payments-service`
2. Add `ledger-service` (Go) with gRPC interface and Postgres integration
3. Set up Postgres and Redis via Docker Compose
4. Integrate Paystack for funding + basic reconciliation flows
5. Build `web-shell`, `mfe-dashboard`, and `mfe-funding`
6. Add `market-data-service` + portfolio modeling and initial `insights-service` integration

---

_Note: This README describes the intended architecture and will be updated as the implementation evolves._
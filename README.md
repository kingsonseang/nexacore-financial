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
- **TS service stack:** Effect.ts, @effect/platform-node, ConnectRPC, Drizzle ORM, argon2, jose
- **Frontend:** React, Module Federation, Nx
- **Payments:** Paystack (funding and reconciliation demo)
- **Market data:** external stock/FX APIs (e.g., Marketstack, CurrencyLayer)
- **Proto tooling:** buf, protoc-gen-es v2 (ConnectRPC service descriptors generated inline, no separate connect-es plugin)
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

### Run services (development)

Each TS service is run directly with `tsx watch` rather than through Nx's `dev` target — `nx:run-commands` with `continuous: true` currently buffers/swallows stdout for long-running watch processes in this workspace on Windows. Run from the service directory:

```bash
cd apps/identity-service && pnpm tsx watch src/main.ts
cd apps/accounts-service && pnpm tsx watch src/main.ts
cd apps/api-gateway && pnpm tsx watch src/main.ts
```

Nx `dev`/`build`/`generate`/`migrate` targets exist and work normally for non-continuous tasks.

### Database setup per service

Each service owns its own Postgres database (not just a schema — see Known workarounds). Create and migrate:

```bash
createdb -U postgres nexacore_identity
createdb -U postgres nexacore_accounts

pnpm nx run identity-service:generate
pnpm nx run identity-service:migrate
pnpm nx run accounts-service:generate
pnpm nx run accounts-service:migrate
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

1. ~~Configure core services~~ — in progress:
   - ✅ `identity-service` — register, login, verifyToken implemented and tested
   - ✅ `accounts-service` — createAccount, getAccount, listWallets, getBalance implemented and tested
   - ✅ `api-gateway` — auth routes (register, login) wired to identity-service, JWT auth middleware in place
   - ⬜ `payments-service` — not started
2. Add `ledger-service` (Go) with gRPC interface and Postgres integration
3. ✅ Postgres (local) and Redis (Docker Compose, infra profile) running
4. Integrate Paystack for funding + basic reconciliation flows
5. Build `web-shell`, `mfe-dashboard`, and `mfe-funding`
6. Add `market-data-service` + portfolio modeling and initial `insights-service` integration
7. ⬜ Unit and integration tests per service — not yet started
8. 
---

_Note: This README describes the intended architecture and will be updated as the implementation evolves._

## Known workarounds

- **ConnectRPC `UnaryImpl` is incompatible with protobuf-es v2 branded `$typeName` types.** `router.service(...)` is cast with `@ts-expect-error`/`as any` at the registration boundary only — handler bodies use explicit `MessageShape<typeof Schema>` parameter types for full internal type safety.
- **`ManagedRuntime.runPromise` wraps all Effect failures in `FiberFailure`,** which ConnectRPC does not recognise, collapsing every error to `Code.Internal`. Each service's `grpc/handler.ts` uses a `runHandler` helper built on `Effect.either` to move the error into the success channel before `runPromise`, then throws the extracted `ConnectError` directly.
- **`@effect/platform`'s `HttpRouter.post` handler type does not reliably infer `Respondable`** from `Effect.gen` generators when the success path returns through nested `Effect.tryPromise` calls. Gateway routes use explicit `Effect.flatMap` chains with typed `Effect.tryPromise<T, ConnectError>` generics instead of generators where this surfaces.
- **gRPC reflection has no official ConnectRPC TypeScript implementation yet** (Go has one, TS does not). Bruno and grpcurl point at `.proto` files directly via `-import-path`/`-proto` instead of using reflection.
- **gRPC JSON encoding requires camelCase field names** (e.g. `userId`, not `user_id`) — snake_case keys are silently dropped as unknown fields rather than erroring, which can mask bugs. Always verify request payloads use the camelCase proto JSON names.
- **`api-gateway`'s `dev` target requires `tsx --watch` (with flag dashes), not `tsx watch`.** Likely a stdin-handling conflict between `tsx`'s watch mode and `@effect/platform-node`'s HTTP server signal handling, surfaced only under Nx's piped (non-TTY) stdin — `api-gateway` is the only service combining both. Other services run correctly with the bare `tsx watch` form; this is service-specific, not workspace-wide.
- **`libs/protos` must be rebuilt (`pnpm nx run protos:build`) after every `protos:generate`**, not just regenerated. Services run directly via `tsx` (bypassing Nx, per the dev-target workaround above) resolve `@org/protos` through its `dist/` build output at runtime, not the `@org/source` TypeScript-only condition. Nx's project graph normally rebuilds this automatically before serving a dependent service — running `tsx` directly skips that step.

## Future considerations

- `accounts-service` currently provisions NGN + USD wallets directly in Postgres on registration. This is intentional for now (mirrors Chipper Cash / Grey — wallets exist freely, KYC gates *actions* not wallet existence) but will eventually be replaced or augmented by a real provider integration (e.g. Paystack subaccounts) to issue real account numbers for receiving money. The `CreateAccount` gRPC contract is expected to remain stable through that change.

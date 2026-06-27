import { createServer } from 'node:http'
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerResponse,
} from '@effect/platform'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { Effect, Layer } from 'effect'
import { BANNER } from './assets/banner.js'
import { AppConfig } from './config/index.js'
import { AccountsClientLive } from './grpc/clients/accounts.js'
import { IdentityClientLive } from './grpc/clients/identity.js'
import { LedgerClientLive } from './grpc/clients/ledger.js'
import { PaymentsClientLive } from './grpc/clients/payments.js'
import { accountsRoutes } from './routes/accounts.js'
import { authRoutes } from './routes/auth.js'
import { ledgerRoutes } from './routes/ledger.js'
import { paymentsRoutes } from './routes/payments.js'

const app = HttpRouter.empty.pipe(
  HttpRouter.get(
    '/',
    HttpServerResponse.text(BANNER, {
      headers: { 'content-type': 'text/plain' },
    }),
  ),
  HttpRouter.mount('/api/v1', authRoutes),
  HttpRouter.mount('/api/v1', accountsRoutes),
  HttpRouter.mount('/api/v1', paymentsRoutes),
  HttpRouter.mount('/api/v1', ledgerRoutes),
  Effect.catchTag('RouteNotFound', () =>
    HttpServerResponse.json({ error: 'Not found' }, { status: 404 }),
  ),
)

const ServerLive = Effect.map(AppConfig.http.port, (port) =>
  NodeHttpServer.layer(createServer, { port }),
).pipe(Layer.unwrapEffect)

const HttpLive = HttpServer.serve(HttpMiddleware.logger(app)).pipe(
  HttpServer.withLogAddress,
  Layer.provide(
    Layer.mergeAll(
      ServerLive,
      IdentityClientLive,
      AccountsClientLive,
      PaymentsClientLive,
      LedgerClientLive,
    ),
  ),
)

Layer.launch(HttpLive).pipe(NodeRuntime.runMain)

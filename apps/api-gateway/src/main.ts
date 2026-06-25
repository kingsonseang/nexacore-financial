import { createServer } from 'node:http'
import {
  HttpMiddleware,
  HttpRouter,
  HttpServer,
  HttpServerResponse,
} from '@effect/platform'
import { NodeHttpServer, NodeRuntime } from '@effect/platform-node'
import { Effect, Layer } from 'effect'
import { AppConfig } from './config/index.js'
import { IdentityClientLive } from './grpc/clients/identity.js'
import { authRoutes } from './routes/auth.js'

const app = HttpRouter.empty.pipe(
  HttpRouter.mount('/api/v1', authRoutes),
  Effect.catchTag('RouteNotFound', () =>
    HttpServerResponse.json({ error: 'Not found' }, { status: 404 }),
  ),
)

const ServerLive = Effect.map(AppConfig.http.port, (port) =>
  NodeHttpServer.layer(createServer, { port }),
).pipe(Layer.unwrapEffect)

const HttpLive = HttpServer.serve(HttpMiddleware.logger(app)).pipe(
  HttpServer.withLogAddress,
  Layer.provide(Layer.merge(ServerLive, IdentityClientLive)),
)

Layer.launch(HttpLive).pipe(NodeRuntime.runMain)

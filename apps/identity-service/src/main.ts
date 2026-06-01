import * as http2 from 'node:http2'
import type { ConnectRouter } from '@connectrpc/connect'
import { connectNodeAdapter } from '@connectrpc/connect-node'
import { NodeRuntime } from '@effect/platform-node'
import { ConfigProvider, Effect, Layer } from 'effect'
import { AppConfig } from './config/index.js'
import { identityRoutes } from './grpc/handler.js'

// --- Routes ---

const routes = (router: ConnectRouter) => {
  identityRoutes(router)
}

// --- Server Layer ---

const ServerLive = Layer.scopedDiscard(
  Effect.gen(function* () {
    const port = yield* AppConfig.grpc.port

    yield* Effect.acquireRelease(
      Effect.async<http2.Http2Server, Error>((resume) => {
        const server = http2.createServer(connectNodeAdapter({ routes }))
        server.listen(port, () => resume(Effect.succeed(server)))
        server.on('error', (err) => resume(Effect.fail(err as Error)))
      }),
      (server) =>
        Effect.promise(
          () => new Promise<void>((resolve) => server.close(() => resolve())),
        ),
    )

    yield* Effect.logInfo(`Identity service listening on :${port}`)
  }),
)

// --- Run ---
NodeRuntime.runMain(
  Layer.launch(ServerLive).pipe(
    Effect.provide(Layer.setConfigProvider(ConfigProvider.fromEnv())),
  ),
)

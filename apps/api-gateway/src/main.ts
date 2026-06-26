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
import { AccountsClientLive } from './grpc/clients/accounts.js'
import { IdentityClientLive } from './grpc/clients/identity.js'
import { PaymentsClientLive } from './grpc/clients/payments.js'
import { accountsRoutes } from './routes/accounts.js'
import { authRoutes } from './routes/auth.js'
import { paymentsRoutes } from './routes/payments.js'

const BANNER = `


NNNNNNNN        NNNNNNNN                                                             CCCCCCCCCCCCC
N:::::::N       N::::::N                                                          CCC::::::::::::C
N::::::::N      N::::::N                                                        CC:::::::::::::::C
N:::::::::N     N::::::N                                                       C:::::CCCCCCCC::::C
N::::::::::N    N::::::N    eeeeeeeeeeee  xxxxxxx      xxxxxxxaaaaaaaaaaaaa   C:::::C       CCCCCC   ooooooooooo   rrrrr   rrrrrrrrr       eeeeeeeeeeee
N:::::::::::N   N::::::N  ee::::::::::::ee x:::::x    x:::::x a::::::::::::a C:::::C               oo:::::::::::oo r::::rrr:::::::::r    ee::::::::::::ee
N:::::::N::::N  N::::::N e::::::eeeee:::::eex:::::x  x:::::x  aaaaaaaaa:::::aC:::::C              o:::::::::::::::or:::::::::::::::::r  e::::::eeeee:::::ee
N::::::N N::::N N::::::Ne::::::e     e:::::e x:::::xx:::::x            a::::aC:::::C              o:::::ooooo:::::orr::::::rrrrr::::::re::::::e     e:::::e
N::::::N  N::::N:::::::Ne:::::::eeeee::::::e  x::::::::::x      aaaaaaa:::::aC:::::C              o::::o     o::::o r:::::r     r:::::re:::::::eeeee::::::e
N::::::N   N:::::::::::Ne:::::::::::::::::e    x::::::::x     aa::::::::::::aC:::::C              o::::o     o::::o r:::::r     rrrrrrre:::::::::::::::::e
N::::::N    N::::::::::Ne::::::eeeeeeeeeee     x::::::::x    a::::aaaa::::::aC:::::C              o::::o     o::::o r:::::r            e::::::eeeeeeeeeee
N::::::N     N:::::::::Ne:::::::e             x::::::::::x  a::::a    a:::::a C:::::C       CCCCCCo::::o     o::::o r:::::r            e:::::::e
N::::::N      N::::::::Ne::::::::e           x:::::xx:::::x a::::a    a:::::a  C:::::CCCCCCCC::::Co:::::ooooo:::::o r:::::r            e::::::::e
N::::::N       N:::::::N e::::::::eeeeeeee  x:::::x  x:::::xa:::::aaaa::::::a   CC:::::::::::::::Co:::::::::::::::o r:::::r             e::::::::eeeeeeee
N::::::N        N::::::N  ee:::::::::::::e x:::::x    x:::::xa::::::::::aa:::a    CCC::::::::::::C oo:::::::::::oo  r:::::r              ee:::::::::::::e
NNNNNNNN         NNNNNNN    eeeeeeeeeeeeeexxxxxxx      xxxxxxxaaaaaaaaaa  aaaa       CCCCCCCCCCCCC   ooooooooooo    rrrrrrr                eeeeeeeeeeeeee


                                                          Financial · API Gateway
`

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
    ),
  ),
)

Layer.launch(HttpLive).pipe(NodeRuntime.runMain)

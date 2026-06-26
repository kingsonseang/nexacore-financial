import { Config } from 'effect'

export const AppConfig = {
  http: {
    port: Config.integer('HTTP_PORT').pipe(Config.withDefault(3000)),
  },
  services: {
    accountsServiceUrl: Config.string('ACCOUNTS_SERVICE_URL').pipe(
      Config.withDefault('http://localhost:50052'),
    ),
    identityServiceUrl: Config.string('IDENTITY_SERVICE_URL').pipe(
      Config.withDefault('http://localhost:50051'),
    ),
    paymentsServiceUrl: Config.string('PAYMENTS_SERVICE_URL').pipe(
      Config.withDefault('http://localhost:50053'),
    ),
  },
  auth: {
    jwtSecret: Config.string('JWT_SECRET'),
  },
} as const

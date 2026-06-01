import { Config } from 'effect'

export const AppConfig = {
  db: {
    url: Config.string('DATABASE_URL'),
  },
  grpc: {
    port: Config.integer('GRPC_PORT').pipe(Config.withDefault(50_051)),
  },
  auth: {
    jwtSecret: Config.string('JWT_SECRET'),
    jwtExpiresIn: Config.string('JWT_EXPIRES_IN').pipe(
      Config.withDefault('15m'),
    ),
    refreshSecret: Config.string('REFRESH_TOKEN_SECRET'),
    refreshExpiresIn: Config.string('REFRESH_TOKEN_EXPIRES_IN').pipe(
      Config.withDefault('7d'),
    ),
  },
} as const

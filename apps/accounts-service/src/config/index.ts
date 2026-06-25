import { Config } from 'effect'

export const AppConfig = {
  db: {
    url: Config.string('DATABASE_URL'),
  },
  grpc: {
    port: Config.integer('GRPC_PORT').pipe(Config.withDefault(50_052)),
  },
} as const

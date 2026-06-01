import { drizzle } from 'drizzle-orm/postgres-js'
import { Context, Effect, Layer } from 'effect'
import postgres from 'postgres'
import { AppConfig } from '../config/index.js'
import * as schema from './schema.js'

export type DrizzleDB = ReturnType<typeof drizzle<typeof schema>>

/*
 * We use Context.GenericTag here instead of the class-based Context.Tag pattern.
 * Context.Tag uses a syntax (extends SomeClass<T>()) that Biome currently cannot
 * parse correctly, causing both formatter errors and cascading TypeScript issues.
 * GenericTag is functionally identical — same DI behaviour, same Layer composition.
 * Revisit if Biome adds support for the class-based Tag syntax.
 */
export const DatabaseService = Context.GenericTag<DrizzleDB>(
  '@nexacore/identity/DatabaseService',
)

export const DatabaseLive = Layer.scoped(
  DatabaseService,
  Effect.gen(function* () {
    const url = yield* AppConfig.db.url

    const client = yield* Effect.acquireRelease(
      Effect.sync(() => postgres(url)),
      (client) => Effect.promise(() => client.end()),
    )

    return drizzle(client, { schema })
  }),
)

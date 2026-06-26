import { Code, ConnectError } from '@connectrpc/connect'
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform'
import type { IdentityPb } from '@org/protos'
import { Effect } from 'effect'
import { IdentityClient } from '../grpc/clients/identity.js'
import { LoginBodySchema, RegisterBodySchema } from '../schemas/auth.js'

// --- Error helpers ---

const grpcToHttp: Record<number, number> = {
  [Code.AlreadyExists]: 409,
  [Code.NotFound]: 404,
  [Code.Unauthenticated]: 401,
  [Code.PermissionDenied]: 403,
  [Code.InvalidArgument]: 400,
  [Code.Internal]: 500,
}

const toConnectError = (e: unknown): ConnectError =>
  e instanceof ConnectError
    ? e
    : new ConnectError('Internal server error', Code.Internal)

const grpcErrorResponse = (e: unknown) =>
  HttpServerResponse.json(
    { error: toConnectError(e).rawMessage },
    { status: grpcToHttp[toConnectError(e).code] ?? 500 },
  )

// --- Routes ---

export const authRoutes = HttpRouter.empty.pipe(
  HttpRouter.post(
    '/auth/register',
    HttpServerRequest.schemaBodyJson(RegisterBodySchema).pipe(
      Effect.flatMap((body) =>
        Effect.flatMap(IdentityClient, (client) =>
          Effect.tryPromise<IdentityPb.RegisterResponse, ConnectError>({
            try: () =>
              client.register({
                email: body.email,
                password: body.password,
                firstName: body.firstName,
                lastName: body.lastName,
                middleName: body.middleName,
              }),
            catch: toConnectError,
          }),
        ),
      ),
      Effect.flatMap((response) =>
        HttpServerResponse.json(
          { userId: response.userId, email: response.email },
          { status: 201 },
        ),
      ),
      Effect.catchTag('RequestError', (e) =>
        HttpServerResponse.json(
          { error: 'Validation failed', details: e.message },
          { status: 400 },
        ),
      ),
      Effect.catchAll(grpcErrorResponse),
    ),
  ),

  HttpRouter.post(
    '/auth/login',
    HttpServerRequest.schemaBodyJson(LoginBodySchema).pipe(
      Effect.flatMap((body) =>
        Effect.flatMap(IdentityClient, (client) =>
          Effect.tryPromise<IdentityPb.LoginResponse, ConnectError>({
            try: () =>
              client.login({
                email: body.email,
                password: body.password,
              }),
            catch: toConnectError,
          }),
        ),
      ),
      Effect.flatMap((response) =>
        HttpServerResponse.json({
          accessToken: response.accessToken,
          refreshToken: response.refreshToken,
        }),
      ),
      Effect.catchTag('RequestError', (e) =>
        HttpServerResponse.json(
          { error: 'Validation failed', details: e.message },
          { status: 400 },
        ),
      ),
      Effect.catchAll(grpcErrorResponse),
    ),
  ),
)

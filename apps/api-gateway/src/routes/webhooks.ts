import { Code, ConnectError } from '@connectrpc/connect'
import {
  HttpRouter,
  HttpServerRequest,
  HttpServerResponse,
} from '@effect/platform'
import type { PaymentsPb } from '@org/protos'
import { Effect } from 'effect'
import { PaymentsClient } from '../grpc/clients/payments.js'

const toConnectError = (e: unknown): ConnectError =>
  e instanceof ConnectError
    ? e
    : new ConnectError('Internal server error', Code.Internal)

export const webhookRoutes = HttpRouter.empty.pipe(
  HttpRouter.post(
    '/webhooks/:provider',
    Effect.flatMap(HttpRouter.params, (params) =>
      Effect.flatMap(HttpServerRequest.HttpServerRequest, (request) =>
        Effect.flatMap(request.text, (rawBody) =>
          Effect.flatMap(PaymentsClient, (client) => {
            const signature = request.headers['x-paystack-signature'] ?? ''

            return Effect.tryPromise<
              PaymentsPb.ConfirmWebhookResponse,
              ConnectError
            >({
              try: () =>
                client.confirmWebhook({
                  provider: params.provider,
                  rawBody,
                  signature,
                }) as Promise<PaymentsPb.ConfirmWebhookResponse>,
              catch: toConnectError,
            })
          }),
        ),
      ),
    ).pipe(
      Effect.flatMap(() => HttpServerResponse.json({ received: true })),
      /*
       * Always return 200 to the provider, even on internal failure.
       * Paystack retries aggressively on non-2xx responses; failures here
       * are logged server-side and should be investigated separately
       * rather than triggering a retry storm against an endpoint that
       * will keep failing for the same underlying reason.
       */
      Effect.catchAll(() => HttpServerResponse.json({ received: true })),
    ),
  ),
)

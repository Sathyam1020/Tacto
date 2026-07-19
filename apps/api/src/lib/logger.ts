import { createObservability } from "@workspace/observability";

import { env } from "../env.js";

/**
 * Process-wide structured logger. Every line goes to stdout and — when
 * OTEL_EXPORTER_OTLP_ENDPOINT is set — is mirrored to PostHog Logs over OTLP.
 * Call `loggerShutdown()` from the graceful-shutdown handler so buffered log
 * records flush on deploy.
 */
export const { logger, shutdown: loggerShutdown } = createObservability({
  serviceName: "tacto-api",
  otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  otlpHeaders: env.OTEL_EXPORTER_OTLP_HEADERS,
  environment: env.NODE_ENV,
});

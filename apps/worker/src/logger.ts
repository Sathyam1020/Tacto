import { createObservability } from "@workspace/observability";

import { env } from "./env.js";

/**
 * Process-wide structured logger for the worker. Mirrors to PostHog Logs over
 * OTLP when OTEL_EXPORTER_OTLP_ENDPOINT is set; stdout-only otherwise. Call
 * `loggerShutdown()` from the shutdown handler to flush buffered records.
 */
export const { logger, shutdown: loggerShutdown } = createObservability({
  serviceName: "tacto-worker",
  otlpEndpoint: env.OTEL_EXPORTER_OTLP_ENDPOINT,
  otlpHeaders: env.OTEL_EXPORTER_OTLP_HEADERS,
  environment: env.NODE_ENV,
});

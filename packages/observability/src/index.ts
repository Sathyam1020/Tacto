import { logs, SeverityNumber } from "@opentelemetry/api-logs"
import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http"
import { resourceFromAttributes } from "@opentelemetry/resources"
import { BatchLogRecordProcessor, LoggerProvider } from "@opentelemetry/sdk-logs"
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions"
import { pino } from "pino"

export type Logger = pino.Logger

export type ObservabilityConfig = {
  /** Distinguishes services in PostHog, e.g. "tacto-api" / "tacto-worker". */
  serviceName: string
  /**
   * OTLP base endpoint, e.g. https://us.i.posthog.com. When absent, logs go to
   * stdout only and no OTLP exporter is created (safe for local/preview).
   */
  otlpEndpoint?: string
  /** OTLP headers in standard "k=v,k2=v2" form, e.g. "Authorization=Bearer phc_…". */
  otlpHeaders?: string
  /** deployment.environment resource attribute. */
  environment?: string
  /** pino level; defaults to "info". */
  level?: string
}

export type Observability = {
  /** Structured logger. Every line is mirrored to PostHog Logs when OTLP is on. */
  logger: Logger
  /** Flush + close the OTLP pipeline. Call from the shutdown handler. */
  shutdown(): Promise<void>
}

// pino numeric level → OTel severity.
const SEVERITY: Record<number, SeverityNumber> = {
  10: SeverityNumber.TRACE,
  20: SeverityNumber.DEBUG,
  30: SeverityNumber.INFO,
  40: SeverityNumber.WARN,
  50: SeverityNumber.ERROR,
  60: SeverityNumber.FATAL,
}

function parseHeaders(raw?: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw) return out
  for (const pair of raw.split(",")) {
    const eq = pair.indexOf("=")
    if (eq === -1) continue
    const k = pair.slice(0, eq).trim()
    const v = pair.slice(eq + 1).trim()
    if (k) out[k] = v
  }
  return out
}

/**
 * Create a pino logger for a Node service. When `otlpEndpoint` is set, every
 * log line is ALSO emitted as an OpenTelemetry log record and shipped to
 * PostHog Logs over OTLP/HTTP — in-process (no worker thread), so it works
 * under tsx. Without an endpoint it's plain stdout pino and `shutdown()` is a
 * no-op. Construct exactly one per process.
 */
export function createObservability(config: ObservabilityConfig): Observability {
  const level = config.level ?? "info"
  const bindings = { service: config.serviceName, env: config.environment }

  if (!config.otlpEndpoint) {
    return { logger: pino({ level, base: bindings }), shutdown: async () => {} }
  }

  // Accept either a base endpoint (…/) or a full logs URL (…/v1/logs).
  const base = config.otlpEndpoint.replace(/\/+$/, "")
  const url = base.endsWith("/v1/logs") ? base : `${base}/v1/logs`

  const provider = new LoggerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      "deployment.environment": config.environment ?? "development",
    }),
    processors: [
      new BatchLogRecordProcessor(
        new OTLPLogExporter({ url, headers: parseHeaders(config.otlpHeaders) })
      ),
    ],
  })
  logs.setGlobalLoggerProvider(provider)
  const otel = provider.getLogger(config.serviceName)

  // A pino destination that writes to stdout AND mirrors each line to OTLP.
  const stream = {
    write(line: string): void {
      process.stdout.write(line)
      try {
        const o = JSON.parse(line) as Record<string, unknown>
        const lvl = typeof o.level === "number" ? o.level : 30
        const time = o.time
        const msg = o.msg
        // Structured fields become OTel attributes (primitives kept, objects
        // JSON-stringified) — pino's own bookkeeping keys are dropped.
        const attributes: Record<string, string | number | boolean> = {}
        for (const [k, v] of Object.entries(o)) {
          if (k === "level" || k === "time" || k === "msg" || k === "pid" || k === "hostname") continue
          attributes[k] =
            typeof v === "string" || typeof v === "number" || typeof v === "boolean"
              ? v
              : JSON.stringify(v)
        }
        otel.emit({
          timestamp: typeof time === "number" ? time : undefined,
          severityNumber: SEVERITY[lvl] ?? SeverityNumber.INFO,
          severityText: pino.levels.labels[lvl],
          body: typeof msg === "string" ? msg : undefined,
          attributes,
        })
      } catch {
        /* non-JSON line — stdout already has it */
      }
    },
  }

  const logger = pino({ level, base: bindings }, stream)
  return {
    logger,
    shutdown: async () => {
      await provider.forceFlush()
      await provider.shutdown()
    },
  }
}

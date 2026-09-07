type TelemetryProps = Record<string, string | number | boolean | undefined>;

/** Lightweight product telemetry — console in dev, optional Sentry breadcrumb. */
export function track(event: string, props?: TelemetryProps) {
  if (typeof window === "undefined") return;
  const payload = { event, ...props, ts: Date.now() };
  if (process.env.NODE_ENV !== "production") {
    console.info("[architectai]", payload);
  }
  try {
    const w = window as Window & {
      __ARCHITECT_EVENTS__?: unknown[];
      Sentry?: { addBreadcrumb?: (b: unknown) => void };
    };
    w.__ARCHITECT_EVENTS__ = w.__ARCHITECT_EVENTS__ || [];
    w.__ARCHITECT_EVENTS__.push(payload);
    w.Sentry?.addBreadcrumb?.({
      category: "architectai",
      message: event,
      data: props,
      level: "info",
    });
  } catch {
    // ignore
  }
}

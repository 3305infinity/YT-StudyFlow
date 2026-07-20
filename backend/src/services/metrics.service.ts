export type MetricsConfig = {
  enabled: boolean;
};

const DEFAULT_CONFIG: Required<MetricsConfig> = {
  enabled: true,
};

let config: Required<MetricsConfig> = { ...DEFAULT_CONFIG };

export function configureMetrics(newConfig: Partial<MetricsConfig>): void {
  config = { ...config, ...newConfig };
}

export function getMetricsConfig(): Readonly<MetricsConfig> {
  return { ...config };
}

export function isMetricsEnabled(): boolean {
  return config.enabled;
}

export type TimingResult<T> = {
  value: T;
  durationMs: number;
};

export async function timeAsync<T>(fn: () => Promise<T>): Promise<TimingResult<T>> {
  if (!config.enabled) {
    const value = await fn();
    return { value, durationMs: 0 };
  }
  const start = Date.now();
  const value = await fn();
  const durationMs = Date.now() - start;
  return { value, durationMs };
}

export function timeSync<T>(fn: () => T): TimingResult<T> {
  if (!config.enabled) {
    const value = fn();
    return { value, durationMs: 0 };
  }
  const start = Date.now();
  const value = fn();
  const durationMs = Date.now() - start;
  return { value, durationMs };
}

export const metricsService = {
  configure: configureMetrics,
  isEnabled: isMetricsEnabled,
  getConfig: getMetricsConfig,
  timeAsync,
  timeSync,
};
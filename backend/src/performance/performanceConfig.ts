export type PerformanceConfig = {
  enabled: boolean;
  maxConcurrentRequests: number;
  enableParallelExecution: boolean;
};

const DEFAULT_CONFIG: Required<PerformanceConfig> = {
  enabled: true,
  maxConcurrentRequests: 100,
  enableParallelExecution: true,
};

let config: Required<PerformanceConfig> = { ...DEFAULT_CONFIG };

export function configurePerformance(newConfig: Partial<PerformanceConfig>): void {
  config = { ...config, ...newConfig };
}

export function getPerformanceConfig(): Readonly<PerformanceConfig> {
  return { ...config };
}

export function isPerformanceEnabled(): boolean {
  return config.enabled;
}

export function getMaxConcurrentRequests(): number {
  return config.maxConcurrentRequests;
}
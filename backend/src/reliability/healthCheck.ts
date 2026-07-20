export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export type ServiceHealth = {
  status: HealthStatus;
  latencyMs?: number;
  error?: string;
};

export type HealthCheckResult = {
  overall: HealthStatus;
  services: {
    pinecone: ServiceHealth;
    gemini: ServiceHealth;
    cache: ServiceHealth;
  };
};

export const HEALTH_CONFIG = {
  pineconeTimeoutMs: 5000,
  geminiTimeoutMs: 15000,
  cacheMaxMemoryEntries: 1000,
};

export function createHealthChecker(deps: {
  pineconeService: { isEnabled: () => boolean; checkHealth?: () => Promise<{ status: 'healthy' | 'unhealthy'; latencyMs?: number; error?: string }> };
  geminiService: { checkHealth?: () => Promise<{ status: 'healthy' | 'unhealthy'; latencyMs?: number; error?: string }> };
  cacheManager: { getStats: () => { sizes: { queryRewrite: number; embedding: number; retrieval: number; packing: number } } };
}) {
  return {
    async check(): Promise<HealthCheckResult> {
      const services: HealthCheckResult['services'] = {
        pinecone: { status: 'healthy' },
        gemini: { status: 'healthy' },
        cache: { status: 'healthy' },
      };

      if (deps.pineconeService.isEnabled()) {
        const start = Date.now();
        try {
          if (deps.pineconeService.checkHealth) {
            const health = await deps.pineconeService.checkHealth();
            services.pinecone = health;
          } else {
            services.pinecone.latencyMs = Date.now() - start;
          }
        } catch (error) {
          services.pinecone = {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : String(error),
          };
        }
      } else {
        services.pinecone = { status: 'degraded', error: 'Disabled' };
      }

      if (deps.geminiService.checkHealth) {
        const start = Date.now();
        try {
          const health = await deps.geminiService.checkHealth();
          services.gemini = health;
        } catch (error) {
          services.gemini = {
            status: 'unhealthy',
            error: error instanceof Error ? error.message : String(error),
            latencyMs: Date.now() - start,
          };
        }
      } else {
        services.gemini = { status: 'degraded', error: 'No health check available' };
      }

      try {
        const stats = deps.cacheManager.getStats();
        const totalEntries = Object.values(stats.sizes).reduce((a, b) => a + b, 0);
        if (totalEntries > HEALTH_CONFIG.cacheMaxMemoryEntries) {
          services.cache = {
            status: 'degraded',
            error: `High memory usage: ${totalEntries} entries`,
          };
        }
      } catch (error) {
        services.cache = {
          status: 'unhealthy',
          error: error instanceof Error ? error.message : String(error),
        };
      }

      const unhealthyCount = Object.values(services).filter((s) => s.status === 'unhealthy').length;
      const degradedCount = Object.values(services).filter((s) => s.status === 'degraded').length;

      let overall: HealthStatus = 'healthy';
      if (unhealthyCount > 0) {
        overall = 'unhealthy';
      } else if (degradedCount > 0) {
        overall = 'degraded';
      }

      return { overall, services };
    },
  };
}
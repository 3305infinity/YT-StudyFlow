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
    /** Embeddings provider. */
    gemini: ServiceHealth;
    /** Text generation provider. */
    groq: ServiceHealth;
    cache: ServiceHealth;
  };
};

export const HEALTH_CONFIG = {
  pineconeTimeoutMs: 5000,
  geminiTimeoutMs: 15000,
  groqTimeoutMs: 15000,
  cacheMaxMemoryEntries: 1000,
};

type ProviderHealth = { checkHealth?: () => Promise<{ status: 'healthy' | 'unhealthy'; latencyMs?: number; error?: string }> };

async function probe(provider: ProviderHealth): Promise<ServiceHealth> {
  if (!provider.checkHealth) return { status: 'degraded', error: 'No health check available' };
  const start = Date.now();
  try {
    return await provider.checkHealth();
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - start,
    };
  }
}

export function createHealthChecker(deps: {
  pineconeService: { isEnabled: () => boolean; checkHealth?: () => Promise<{ status: 'healthy' | 'unhealthy'; latencyMs?: number; error?: string }> };
  geminiService: ProviderHealth;
  groqService: ProviderHealth;
  cacheManager: { getStats: () => { sizes: { queryRewrite: number; embedding: number; retrieval: number; packing: number } } };
}) {
  return {
    async check(): Promise<HealthCheckResult> {
      const services: HealthCheckResult['services'] = {
        pinecone: { status: 'healthy' },
        gemini: { status: 'healthy' },
        groq: { status: 'healthy' },
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

      [services.gemini, services.groq] = await Promise.all([
        probe(deps.geminiService),
        probe(deps.groqService),
      ]);

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
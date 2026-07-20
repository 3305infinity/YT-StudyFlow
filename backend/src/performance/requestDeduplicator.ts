import { getPerformanceConfig } from './performanceConfig.js';

type PendingRequest<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
};

type RequestKey = string;

class RequestDeduplicator {
  private pendingRequests: Map<RequestKey, PendingRequest<unknown>> = new Map();
  private config = getPerformanceConfig();

  execute<T>(key: RequestKey, fn: () => Promise<T>): Promise<T> {
    if (!this.config.enabled) {
      return fn();
    }

    const existing = this.pendingRequests.get(key);
    if (existing) {
      return existing.promise as Promise<T>;
    }

    let resolve!: (value: T) => void;
    let reject!: (error: Error) => void;

    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    const pending: PendingRequest<T> = { promise, resolve, reject };
    this.pendingRequests.set(key, pending as PendingRequest<unknown>);

    fn()
      .then((result) => {
        resolve(result);
        this.pendingRequests.delete(key);
      })
      .catch((error) => {
        reject(error);
        this.pendingRequests.delete(key);
      });

    return promise;
  }

  hasPending(key: RequestKey): boolean {
    return this.pendingRequests.has(key);
  }

  getPendingCount(): number {
    return this.pendingRequests.size;
  }

  clear(): void {
    this.pendingRequests.clear();
  }
}

export const requestDeduplicator = new RequestDeduplicator();
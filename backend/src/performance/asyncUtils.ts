import { getPerformanceConfig } from './performanceConfig.js';

export async function parallel<T1, T2>(
  a: () => Promise<T1>,
  b: () => Promise<T2>
): Promise<[T1, T2]> {
  const config = getPerformanceConfig();
  if (!config.enabled || !config.enableParallelExecution) {
    const r1 = await a();
    const r2 = await b();
    return [r1, r2];
  }
  return Promise.all([a(), b()]) as Promise<[T1, T2]>;
}

export async function parallel3<T1, T2, T3>(
  a: () => Promise<T1>,
  b: () => Promise<T2>,
  c: () => Promise<T3>
): Promise<[T1, T2, T3]> {
  const config = getPerformanceConfig();
  if (!config.enabled || !config.enableParallelExecution) {
    const r1 = await a();
    const r2 = await b();
    const r3 = await c();
    return [r1, r2, r3];
  }
  return Promise.all([a(), b(), c()]) as Promise<[T1, T2, T3]>;
}

export async function parallel4<T1, T2, T3, T4>(
  a: () => Promise<T1>,
  b: () => Promise<T2>,
  c: () => Promise<T3>,
  d: () => Promise<T4>
): Promise<[T1, T2, T3, T4]> {
  const config = getPerformanceConfig();
  if (!config.enabled || !config.enableParallelExecution) {
    const r1 = await a();
    const r2 = await b();
    const r3 = await c();
    const r4 = await d();
    return [r1, r2, r3, r4];
  }
  return Promise.all([a(), b(), c(), d()]) as Promise<[T1, T2, T3, T4]>;
}

export function makeParallel<T>(fn: () => Promise<T>): () => Promise<T> {
  const config = getPerformanceConfig();
  if (!config.enabled || !config.enableParallelExecution) {
    return fn;
  }
  return fn;
}
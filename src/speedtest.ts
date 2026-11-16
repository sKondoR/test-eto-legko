export const REQUEST_COUNT = 10;
const TIMEOUT_MS = 30_000;

export interface RequestResult {
  durationMs: number;
  bytes: number;
}

export interface Summary {
  requests: number;
  totalBytes: number;
  totalMs: number;
  averageMs: number;
  bitsPerSecond: number;
}

/** Делает один запрос и читает тело до конца. Время — от вызова fetch до последнего байта. */
export async function measureRequest(url: string): Promise<RequestResult> {
  const start = performance.now();
  const response = await fetch(url, {
    // Без сжатия считаем ровно те байты, что пришли по сети.
    headers: { "Accept-Encoding": "identity" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  }

  let bytes = 0;
  if (response.body) {
    // Тело читаем потоком и не храним: важен только размер.
    for await (const chunk of response.body) bytes += chunk.byteLength;
  }
  return { durationMs: performance.now() - start, bytes };
}

/** Делает `count` запросов строго по очереди. `onResult` получает номер запроса, начиная с 1. */
export async function measure(
  url: string,
  count: number,
  onResult?: (result: RequestResult, number: number) => void,
): Promise<RequestResult[]> {
  const results: RequestResult[] = [];
  for (let number = 1; number <= count; number++) {
    const result = await measureRequest(url);
    results.push(result);
    onResult?.(result, number);
  }
  return results;
}

export function summarize(results: RequestResult[]): Summary {
  const totalBytes = results.reduce((sum, r) => sum + r.bytes, 0);
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
  return {
    requests: results.length,
    totalBytes,
    totalMs,
    averageMs: totalMs / results.length,
    bitsPerSecond: (totalBytes * 8) / (totalMs / 1000),
  };
}

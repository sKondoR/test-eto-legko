export const REQUEST_COUNT = 10;
const TIMEOUT_MS = 30_000;

export interface RequestResult {
  durationMs: number;
  bytes: number;
  /** Сервер сжал ответ вопреки identity, и fetch распаковал тело: `bytes` посчитаны после распаковки. */
  decoded: boolean;
}

export interface MeasureOptions {
  /** Вызывается после каждого запроса; номер запроса начинается с 1. */
  onResult?: (result: RequestResult, requestNumber: number) => void;
  /** Ограничивает каждый запрос целиком, вместе с чтением тела. */
  timeoutMs?: number;
}

export interface Summary {
  requests: number;
  totalBytes: number;
  averageMs: number;
  bitsPerSecond: number;
}

/** Делает один запрос и читает тело до конца. Время — от вызова fetch до последнего байта. */
async function measureRequest(url: string, timeoutMs: number): Promise<RequestResult> {
  const start = performance.now();
  const response = await fetch(url, {
    // Просим без сжатия: fetch распаковывает тело сам, и тогда байты не совпадут с пришедшими по сети.
    headers: { "Accept-Encoding": "identity" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  }

  const encoding = response.headers.get("content-encoding");
  const decoded = encoding !== null && encoding !== "identity";

  let bytes = 0;
  if (response.body) {
    // Тело читаем потоком и не храним: важен только размер.
    for await (const chunk of response.body) bytes += chunk.byteLength;
  }
  return { durationMs: performance.now() - start, bytes, decoded };
}

/** Делает `count` запросов строго по очереди. */
export async function measure(
  url: string,
  count: number,
  { onResult, timeoutMs = TIMEOUT_MS }: MeasureOptions = {},
): Promise<RequestResult[]> {
  const results: RequestResult[] = [];
  for (let requestNumber = 1; requestNumber <= count; requestNumber++) {
    const result = await measureRequest(url, timeoutMs);
    results.push(result);
    onResult?.(result, requestNumber);
  }
  return results;
}

export function summarize(results: RequestResult[]): Summary {
  const totalBytes = results.reduce((sum, r) => sum + r.bytes, 0);
  const totalMs = results.reduce((sum, r) => sum + r.durationMs, 0);
  return {
    requests: results.length,
    totalBytes,
    averageMs: totalMs / results.length,
    bitsPerSecond: (totalBytes * 8) / (totalMs / 1000),
  };
}

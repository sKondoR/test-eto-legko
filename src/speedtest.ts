export const REQUEST_COUNT = 10;
const IDLE_TIMEOUT_MS = 30_000;
// Кодировки, которые fetch в Node распаковывает сам.
const FETCH_DECODES = new Set(["gzip", "x-gzip", "deflate", "br", "zstd"]);

export interface RequestResult {
  durationMs: number;
  bytes: number;
  /** Сервер сжал ответ вопреки identity, и fetch распаковал тело: `bytes` посчитаны после распаковки. */
  decoded: boolean;
}

export interface MeasureOptions {
  /** Вызывается после каждого запроса; номер запроса начинается с 1. */
  onResult?: (result: RequestResult, requestNumber: number) => void;
  /** Сколько ждать следующую порцию данных: заголовки или очередной кусок тела. */
  idleTimeoutMs?: number;
}

export interface Summary {
  requests: number;
  totalBytes: number;
  averageMs: number;
  bitsPerSecond: number;
}

/** Делает один запрос и читает тело до конца. Время — от вызова fetch до последнего байта. */
async function measureRequest(url: string, idleTimeoutMs: number): Promise<RequestResult> {
  // Таймаут простоя, а не общий срок: долгая загрузка тяжёлого файла не обрывается, пока данные идут.
  const controller = new AbortController();
  let idleTimer: NodeJS.Timeout | undefined;
  const restartIdleTimer = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(
      () =>
        controller.abort(new Error(`Сервер не присылает данные дольше ${idleTimeoutMs / 1000} с`)),
      idleTimeoutMs,
    );
  };

  const start = performance.now();
  restartIdleTimer();
  try {
    const response = await fetch(url, {
      // Просим без сжатия: fetch распаковывает тело сам, и тогда байты не совпадут с пришедшими по сети.
      headers: { "Accept-Encoding": "identity" },
      signal: controller.signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
    }

    const decoded = isDecodedByFetch(response.headers.get("content-encoding"));

    let bytes = 0;
    if (response.body) {
      // Тело читаем потоком и не храним: важен только размер.
      for await (const chunk of response.body) {
        restartIdleTimer();
        bytes += chunk.byteLength;
      }
    }
    return { durationMs: performance.now() - start, bytes, decoded };
  } finally {
    clearTimeout(idleTimer);
  }
}

/**
 * fetch распаковывает тело, только если знает все кодировки из списка; иначе отдаёт байты как есть.
 * `identity` fetch тоже считает незнакомой: «identity, gzip» остаётся сжатым.
 */
function isDecodedByFetch(contentEncoding: string | null): boolean {
  const codings = (contentEncoding ?? "")
    .split(",")
    .map((coding) => coding.trim().toLowerCase())
    .filter((coding) => coding !== "");
  return codings.length > 0 && codings.every((coding) => FETCH_DECODES.has(coding));
}

/** Делает `count` запросов строго по очереди. */
export async function measure(
  url: string,
  count: number,
  { onResult, idleTimeoutMs = IDLE_TIMEOUT_MS }: MeasureOptions = {},
): Promise<RequestResult[]> {
  const results: RequestResult[] = [];
  for (let requestNumber = 1; requestNumber <= count; requestNumber++) {
    const result = await measureRequest(url, idleTimeoutMs);
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

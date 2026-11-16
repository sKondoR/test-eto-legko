import type { Progress, RequestResult, Summary } from "./speedtest.ts";

// Десятичные единицы, как у провайдеров и Speedtest: 1 МБ = 10⁶ байт, 1 Мбит = 10⁶ бит.
const DECIMAL_MEGA = 1_000_000;
const PROGRESS_BAR_WIDTH = 20;

function formatMs(ms: number): string {
  return `${ms.toFixed(1)} мс`;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / DECIMAL_MEGA).toFixed(2)} МБ`;
}

function formatMegabits(bitsPerSecond: number): string {
  return `${(bitsPerSecond / DECIMAL_MEGA).toFixed(2)} Мбит/с`;
}

function formatSpeed(bitsPerSecond: number): string {
  const mbytes = bitsPerSecond / 8 / DECIMAL_MEGA;
  return `${formatMegabits(bitsPerSecond)} (${mbytes.toFixed(2)} МБ/с)`;
}

function formatRequestLabel(requestNumber: number, count: number): string {
  const padded = String(requestNumber).padStart(String(count).length);
  return `Запрос ${padded}/${count}:`;
}

export function formatRequestLine(
  result: RequestResult,
  requestNumber: number,
  count: number,
): string {
  const label = formatRequestLabel(requestNumber, count);
  return `${label} ${formatMs(result.durationMs)}, ${formatMegabytes(result.bytes)}`;
}

/** Строка прогресса текущего запроса. Без известного размера — только объём и скорость. */
export function formatProgress(progress: Progress, requestNumber: number, count: number): string {
  const label = formatRequestLabel(requestNumber, count);
  const speed = formatMegabits((progress.bytes * 8) / (progress.elapsedMs / 1000));
  if (progress.totalBytes === null) {
    return `${label} ${formatMegabytes(progress.bytes)}  ${speed}`;
  }

  const share = progress.bytes / progress.totalBytes;
  const filled = Math.round(share * PROGRESS_BAR_WIDTH);
  const bar = "▓".repeat(filled) + "░".repeat(PROGRESS_BAR_WIDTH - filled);
  const done = (progress.bytes / DECIMAL_MEGA).toFixed(2);
  const percent = Math.floor(share * 100);
  return `${label} ${bar}  ${done} / ${formatMegabytes(progress.totalBytes)}  ${percent}%  ${speed}`;
}

export function formatSummary(summary: Summary): string {
  return [
    `Запросов:            ${summary.requests}`,
    `Среднее время:       ${formatMs(summary.averageMs)}`,
    `Скачано всего:       ${formatMegabytes(summary.totalBytes)}`,
    `Скорость скачивания: ${formatSpeed(summary.bitsPerSecond)}`,
  ].join("\n");
}

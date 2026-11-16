import type { RequestResult, Summary } from "./speedtest.ts";

// Десятичные единицы, как у провайдеров и Speedtest: 1 МБ = 10⁶ байт, 1 Мбит = 10⁶ бит.
const DECIMAL_MEGA = 1_000_000;

function formatMs(ms: number): string {
  return `${ms.toFixed(1)} мс`;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / DECIMAL_MEGA).toFixed(2)} МБ`;
}

function formatSpeed(bitsPerSecond: number): string {
  const mbits = bitsPerSecond / DECIMAL_MEGA;
  const mbytes = bitsPerSecond / 8 / DECIMAL_MEGA;
  return `${mbits.toFixed(2)} Мбит/с (${mbytes.toFixed(2)} МБ/с)`;
}

export function formatRequestLine(
  result: RequestResult,
  requestNumber: number,
  count: number,
): string {
  const padded = String(requestNumber).padStart(String(count).length);
  return `Запрос ${padded}/${count}: ${formatMs(result.durationMs)}, ${formatMegabytes(result.bytes)}`;
}

export function formatSummary(summary: Summary): string {
  return [
    `Запросов:            ${summary.requests}`,
    `Среднее время:       ${formatMs(summary.averageMs)}`,
    `Скачано всего:       ${formatMegabytes(summary.totalBytes)}`,
    `Скорость скачивания: ${formatSpeed(summary.bitsPerSecond)}`,
  ].join("\n");
}

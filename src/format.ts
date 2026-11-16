import type { RequestResult, Summary } from "./speedtest.ts";

// Десятичные единицы, как у провайдеров и Speedtest: 1 МБ = 10⁶ байт, 1 Мбит = 10⁶ бит.
const BYTES_IN_MB = 1_000_000;
const BITS_IN_MBIT = 1_000_000;

export function formatMs(ms: number): string {
  return `${ms.toFixed(1)} мс`;
}

export function formatMegabytes(bytes: number): string {
  return `${(bytes / BYTES_IN_MB).toFixed(2)} МБ`;
}

export function formatSpeed(bitsPerSecond: number): string {
  const mbits = bitsPerSecond / BITS_IN_MBIT;
  const mbytes = bitsPerSecond / 8 / BYTES_IN_MB;
  return `${mbits.toFixed(2)} Мбит/с (${mbytes.toFixed(2)} МБ/с)`;
}

export function formatRequestLine(result: RequestResult, number: number, count: number): string {
  const padded = String(number).padStart(String(count).length);
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

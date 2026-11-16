import type { RequestResult, Summary } from "./speedtest.ts";

// Десятичные единицы, как у провайдеров и Speedtest: 1 МБ = 10⁶ байт, 1 Мбит = 10⁶ бит.
const MEGA = 1_000_000;

function formatMs(ms: number): string {
  return `${ms.toFixed(1)} мс`;
}

function formatMegabytes(bytes: number): string {
  return `${(bytes / MEGA).toFixed(2)} МБ`;
}

function formatSpeed(bitsPerSecond: number): string {
  const mbits = bitsPerSecond / MEGA;
  const mbytes = bitsPerSecond / 8 / MEGA;
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

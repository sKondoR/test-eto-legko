import { describe, expect, it } from "vitest";
import { formatProgress, formatRequestLine, formatSummary } from "../src/format.ts";

describe("строки вывода", () => {
  it("выравнивает номер запроса по ширине общего числа", () => {
    const result = { durationMs: 512.34, bytes: 2_500_000, decoded: false };
    expect(formatRequestLine(result, 1, 10)).toBe("Запрос  1/10: 512.3 мс, 2.50 МБ");
    expect(formatRequestLine(result, 10, 10)).toBe("Запрос 10/10: 512.3 мс, 2.50 МБ");
  });

  // 2 610 000 байт за 543.75 мс = 38.4 Мбит/с.
  it("рисует прогресс с полосой и процентами, если размер известен", () => {
    const progress = { bytes: 2_610_000, totalBytes: 5_000_000, elapsedMs: 543.75 };
    expect(formatProgress(progress, 3, 10)).toBe(
      "Запрос  3/10: ▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░  2.61 / 5.00 МБ  52%  38.40 Мбит/с",
    );
  });

  it("рисует прогресс без полосы и процентов, если размер неизвестен", () => {
    const progress = { bytes: 2_610_000, totalBytes: null, elapsedMs: 543.75 };
    expect(formatProgress(progress, 3, 10)).toBe("Запрос  3/10: 2.61 МБ  38.40 Мбит/с");
  });

  it("печатает блок итогов", () => {
    const text = formatSummary({
      requests: 10,
      totalBytes: 50_000_000,
      averageMs: 500,
      bitsPerSecond: 80_000_000,
    });
    expect(text).toBe(
      [
        "Запросов:            10",
        "Среднее время:       500.0 мс",
        "Скачано всего:       50.00 МБ",
        "Скорость скачивания: 80.00 Мбит/с (10.00 МБ/с)",
      ].join("\n"),
    );
  });
});

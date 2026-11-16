import { describe, expect, it } from "vitest";
import { formatRequestLine, formatSummary } from "../src/format.ts";

describe("строки вывода", () => {
  it("выравнивает номер запроса по ширине общего числа", () => {
    const result = { durationMs: 512.34, bytes: 2_500_000, decoded: false };
    expect(formatRequestLine(result, 1, 10)).toBe("Запрос  1/10: 512.3 мс, 2.50 МБ");
    expect(formatRequestLine(result, 10, 10)).toBe("Запрос 10/10: 512.3 мс, 2.50 МБ");
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

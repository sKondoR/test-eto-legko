import { expect, it } from "vitest";
import { runCli } from "../helpers/cli.ts";

// Ответ ровно 5 000 000 байт; адрес можно заменить переменной LIVE_URL.
const DEFAULT_URL = "https://speed.cloudflare.com/__down?bytes=5000000";
const url = process.env.LIVE_URL ?? DEFAULT_URL;

it(`замеряет скорость на ${url}`, async () => {
  const run = await runCli([url]);

  expect(run.stderr).toBe("");
  expect(run.code).toBe(0);
  expect(run.stdout.match(/^Запрос /gm)).toHaveLength(10);

  const total = Number(run.stdout.match(/Скачано всего:\s+([\d.]+) МБ/)?.[1]);
  const speed = Number(run.stdout.match(/Скорость скачивания:\s+([\d.]+) Мбит\/с/)?.[1]);
  // Размер известен только для адреса по умолчанию: так ловим сжатие или недочитанное тело у реального CDN.
  if (url === DEFAULT_URL) expect(total).toBe(50);
  expect(total).toBeGreaterThan(0);
  expect(speed).toBeGreaterThan(0);
});

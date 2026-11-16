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
  if (url === DEFAULT_URL) expect(run.stdout).toContain("Скачано всего:       50.00 МБ");

  const speed = Number(run.stdout.match(/Скорость скачивания: ([\d.]+) Мбит\/с/)?.[1]);
  expect(speed).toBeGreaterThan(0);
});

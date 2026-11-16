import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { runCli } from "./helpers/cli.ts";
import { startServer, type TestServer } from "./helpers/server.ts";

describe("cli", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startServer((req, res) => {
      if (req.url === "/missing") {
        res.writeHead(404).end();
        return;
      }
      res.end(Buffer.alloc(250_000));
    });
  });

  afterAll(() => server.close());

  it("без адреса печатает подсказку и выходит с кодом 1", async () => {
    const run = await runCli([]);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("Использование");
  });

  it.each(["не-адрес", "ftp://example.com/file"])("отклоняет адрес %s", async (arg) => {
    const run = await runCli([arg]);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("Некорректный адрес");
  });

  it("при ошибке HTTP пишет в stderr и выходит с кодом 1", async () => {
    const run = await runCli([`${server.url}/missing`]);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("HTTP 404");
  });

  it("печатает 10 строк запросов и итог", async () => {
    const run = await runCli([`${server.url}/file`]);
    expect(run.code).toBe(0);
    expect(run.stdout.match(/^Запрос /gm)).toHaveLength(10);
    expect(run.stdout).toContain("Скачано всего:       2.50 МБ");
    expect(run.stdout).toMatch(/Скорость скачивания: [\d.]+ Мбит\/с/);
  });
});

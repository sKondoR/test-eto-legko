import { gzipSync } from "node:zlib";
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
      if (req.url === "/gzip-anyway") {
        res.writeHead(200, { "Content-Encoding": "gzip" }).end(gzipSync(Buffer.alloc(250_000)));
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

  it("при недоступном сервере выходит с кодом 1 и показывает причину", async () => {
    const closed = await startServer(() => {});
    const url = `${closed.url}/file`;
    await closed.close();

    const run = await runCli([url]);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain("ECONNREFUSED");
  }, 15_000);

  it("принимает протокол в верхнем регистре", async () => {
    const run = await runCli([`${server.url.replace("http", "HTTP")}/file`]);
    expect(run.code).toBe(0);
  });

  it("предупреждает в stderr, если сервер сжал ответ", async () => {
    const run = await runCli([`${server.url}/gzip-anyway`]);
    expect(run.code).toBe(0);
    expect(run.stderr).toContain("после распаковки");
  });

  it("печатает 10 строк запросов и итог", async () => {
    const run = await runCli([`${server.url}/file`]);
    expect(run.code).toBe(0);
    expect(run.stderr).toBe("");
    expect(run.stdout.match(/^Запрос /gm)).toHaveLength(10);
    expect(run.stdout).toMatch(/Скачано всего:\s+2\.50 МБ/);
    expect(run.stdout).toMatch(/Скорость скачивания: [\d.]+ Мбит\/с/);
  });
});

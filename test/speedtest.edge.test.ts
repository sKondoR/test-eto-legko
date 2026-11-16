import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { measure } from "../src/speedtest.ts";
import { startServer, type TestServer } from "./helpers/server.ts";

const BODY_SIZE = 100_000;
// Нули сжимаются в сотни байт: разница между «по сети» и «после распаковки» огромная.
const GZIPPED = gzipSync(Buffer.alloc(BODY_SIZE));

describe("measure: граничные случаи", () => {
  let server: TestServer;
  let failThirdCount = 0;

  beforeAll(async () => {
    server = await startServer((req, res) => {
      switch (req.url) {
        case "/file":
          res.end(Buffer.alloc(BODY_SIZE));
          return;
        case "/redirect":
          res.writeHead(302, { Location: "/file" }).end();
          return;
        case "/redirect-loop":
          res.writeHead(302, { Location: "/redirect-loop" }).end();
          return;
        case "/empty":
          res.end();
          return;
        case "/no-content":
          res.writeHead(204).end();
          return;
        case "/gzip-anyway":
          // Сервер игнорирует Accept-Encoding: identity и всё равно сжимает.
          res.writeHead(200, { "Content-Encoding": "gzip", "Content-Length": GZIPPED.length });
          res.end(GZIPPED);
          return;
        case "/fail-third":
          failThirdCount++;
          if (failThirdCount === 3) res.writeHead(500).end();
          else res.end(Buffer.alloc(BODY_SIZE));
          return;
        case "/truncated":
          // Обещает 100 000 байт, отдаёт половину и рвёт соединение.
          res.writeHead(200, { "Content-Length": BODY_SIZE });
          res.write(Buffer.alloc(BODY_SIZE / 2), () => res.destroy());
          return;
        case "/stall":
          // Отдаёт заголовки и часть тела, потом молчит.
          res.writeHead(200);
          res.write(Buffer.alloc(1000));
          return;
      }
    });
  });

  afterAll(() => server.close());

  it("идёт по редиректу и считает байты конечного ответа", async () => {
    const results = await measure(`${server.url}/redirect`, 2);
    expect(results.map((r) => r.bytes)).toEqual([BODY_SIZE, BODY_SIZE]);
  });

  it("падает на бесконечном редиректе", async () => {
    await expect(measure(`${server.url}/redirect-loop`, 1)).rejects.toThrow();
  });

  it("считает 0 байт для пустого тела и ответа 204", async () => {
    const [empty] = await measure(`${server.url}/empty`, 1);
    const [noContent] = await measure(`${server.url}/no-content`, 1);
    expect(empty?.bytes).toBe(0);
    expect(noContent?.bytes).toBe(0);
  });

  it("помечает ответ, который сервер сжал вопреки identity: fetch отдаёт байты после распаковки", async () => {
    const [compressed] = await measure(`${server.url}/gzip-anyway`, 1);
    const [plain] = await measure(`${server.url}/file`, 1);
    expect(compressed).toMatchObject({ bytes: BODY_SIZE, decoded: true });
    expect(plain).toMatchObject({ bytes: BODY_SIZE, decoded: false });
  });

  it("останавливается на первой ошибке и не делает запросы после неё", async () => {
    const numbers: number[] = [];
    await expect(
      measure(`${server.url}/fail-third`, 10, (_, number) => numbers.push(number)),
    ).rejects.toThrow("HTTP 500");
    expect(numbers).toEqual([1, 2]);
    expect(failThirdCount).toBe(3);
  });

  it("падает, если соединение оборвалось посреди тела", async () => {
    await expect(measure(`${server.url}/truncated`, 1)).rejects.toThrow();
  });

  it("падает по таймауту, если сервер замолчал посреди тела", async () => {
    await expect(measure(`${server.url}/stall`, 1, undefined, 200)).rejects.toThrow(/timeout/i);
  });
});

import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { measure, summarize } from "../src/speedtest.ts";
import { startServer, type TestServer } from "./helpers/server.ts";

describe("summarize", () => {
  it("считает сумму, среднее время и скорость по общему объёму и времени", () => {
    const summary = summarize([
      { durationMs: 1000, bytes: 1_000_000, decoded: false },
      { durationMs: 3000, bytes: 3_000_000, decoded: false },
    ]);

    expect(summary).toEqual({
      requests: 2,
      totalBytes: 4_000_000,
      averageMs: 2000,
      bitsPerSecond: 8_000_000,
    });
  });
});

describe("measure", () => {
  const BODY_SIZE = 100_000;
  let server: TestServer;
  let active = 0;
  let maxActive = 0;
  const acceptEncodings: (string | undefined)[] = [];
  let failThirdCount = 0;

  beforeAll(async () => {
    server = await startServer((req, res) => {
      switch (req.url) {
        case "/sequential":
          active++;
          maxActive = Math.max(maxActive, active);
          acceptEncodings.push(req.headers["accept-encoding"]);
          res.on("close", () => active--);
          res.end(Buffer.alloc(BODY_SIZE));
          return;
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
          res.writeHead(200, { "Content-Encoding": "gzip" }).end(gzipSync(Buffer.alloc(BODY_SIZE)));
          return;
        case "/fail-third":
          failThirdCount++;
          if (failThirdCount === 3) res.writeHead(500).end();
          else res.end(Buffer.alloc(BODY_SIZE));
          return;
        case "/truncated":
          // Обещает BODY_SIZE байт, отдаёт половину и рвёт соединение.
          res.writeHead(200, { "Content-Length": BODY_SIZE });
          res.write(Buffer.alloc(BODY_SIZE / 2), () => res.destroy());
          return;
        case "/stall":
          // Отдаёт заголовки и часть тела, потом молчит.
          res.writeHead(200);
          res.write(Buffer.alloc(1000));
          return;
        default:
          res.writeHead(404).end();
      }
    });
  });

  afterAll(() => server.close());

  it("делает запросы по очереди и считает байты тела", async () => {
    const requestNumbers: number[] = [];
    const results = await measure(`${server.url}/sequential`, 10, {
      onResult: (_, requestNumber) => requestNumbers.push(requestNumber),
    });

    expect(results).toHaveLength(10);
    expect(results.every((r) => r.bytes === BODY_SIZE)).toBe(true);
    expect(results.every((r) => r.durationMs > 0)).toBe(true);
    expect(requestNumbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(maxActive).toBe(1);
    // Ровно 10 обращений к серверу, и в каждом выключено сжатие.
    expect(acceptEncodings).toEqual(Array(10).fill("identity"));
  });

  it("останавливается на первой ошибке HTTP и не делает запросы после неё", async () => {
    failThirdCount = 0;
    const requestNumbers: number[] = [];
    await expect(
      measure(`${server.url}/fail-third`, 10, {
        onResult: (_, requestNumber) => requestNumbers.push(requestNumber),
      }),
    ).rejects.toThrow("HTTP 500");
    expect(requestNumbers).toEqual([1, 2]);
    expect(failThirdCount).toBe(3);
  });

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

  it("падает, если соединение оборвалось посреди тела", async () => {
    await expect(measure(`${server.url}/truncated`, 1)).rejects.toThrow();
  });

  it("падает по таймауту, если сервер замолчал посреди тела", async () => {
    await expect(measure(`${server.url}/stall`, 1, { timeoutMs: 200 })).rejects.toThrow(/timeout/i);
  });
});

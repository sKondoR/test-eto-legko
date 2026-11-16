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

  beforeAll(async () => {
    server = await startServer((req, res) => {
      if (req.url === "/missing") {
        res.writeHead(404).end("not found");
        return;
      }
      active++;
      maxActive = Math.max(maxActive, active);
      acceptEncodings.push(req.headers["accept-encoding"]);
      res.on("close", () => active--);
      res.writeHead(200, { "Content-Type": "application/octet-stream" });
      res.end(Buffer.alloc(BODY_SIZE));
    });
  });

  afterAll(() => server.close());

  it("делает запросы по очереди и считает байты тела", async () => {
    const numbers: number[] = [];
    const results = await measure(`${server.url}/file`, 10, (_, number) => numbers.push(number));

    expect(results).toHaveLength(10);
    expect(results.every((r) => r.bytes === BODY_SIZE)).toBe(true);
    expect(results.every((r) => r.durationMs > 0)).toBe(true);
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(maxActive).toBe(1);
    // Ровно 10 обращений к серверу, и в каждом выключено сжатие.
    expect(acceptEncodings).toEqual(Array(10).fill("identity"));
  });

  it("падает на статусе не 2xx", async () => {
    await expect(measure(`${server.url}/missing`, 10)).rejects.toThrow("HTTP 404");
  });
});

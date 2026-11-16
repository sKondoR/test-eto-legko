import { formatRequestLine, formatSummary } from "./format.ts";
import { REQUEST_COUNT, measure, summarize } from "./speedtest.ts";

const USAGE = "Использование: node src/cli.ts <url>";

function parseUrl(arg: string): URL | undefined {
  try {
    const url = new URL(arg);
    return url.protocol === "http:" || url.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

// fetch прячет настоящую причину сетевой ошибки в `cause`.
function describeError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  return error.cause instanceof Error ? `${error.message}: ${error.cause.message}` : error.message;
}

async function main(): Promise<number> {
  const arg = process.argv[2];
  if (!arg) {
    console.error(USAGE);
    return 1;
  }
  const url = parseUrl(arg);
  if (!url) {
    console.error(`Некорректный адрес: ${arg}. Нужен http:// или https:// URL.`);
    console.error(USAGE);
    return 1;
  }

  console.log(`Скачиваю ${url.href} ${REQUEST_COUNT} раз подряд...`);
  try {
    const results = await measure(url.href, REQUEST_COUNT, (result, number) =>
      console.log(formatRequestLine(result, number, REQUEST_COUNT)),
    );
    console.log();
    console.log(formatSummary(summarize(results)));
    return 0;
  } catch (error) {
    console.error(`Ошибка: ${describeError(error)}`);
    return 1;
  }
}

process.exitCode = await main();

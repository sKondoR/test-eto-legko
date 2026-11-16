import { clearLine, cursorTo } from "node:readline";
import { formatProgress, formatRequestLine, formatSummary } from "./format.ts";
import { REQUEST_COUNT, measure, summarize } from "./speedtest.ts";

const USAGE = "Использование: node src/cli.ts <url>";
const PROGRESS_INTERVAL_MS = 100;

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

  // Прогресс рисуем только в терминале: в файле или pipe строки с \r стали бы мусором.
  const showProgress = process.stdout.isTTY;
  let lastProgressAt = 0;
  const clearProgress = () => {
    clearLine(process.stdout, 0);
    cursorTo(process.stdout, 0);
  };

  console.log(`Скачиваю ${url.href} ${REQUEST_COUNT} раз подряд...`);
  try {
    const results = await measure(url.href, REQUEST_COUNT, {
      onProgress: showProgress
        ? (progress, requestNumber) => {
            // Редкая перерисовка почти не тратит время внутри замера.
            const now = performance.now();
            if (now - lastProgressAt < PROGRESS_INTERVAL_MS) return;
            lastProgressAt = now;
            clearProgress();
            process.stdout.write(formatProgress(progress, requestNumber, REQUEST_COUNT));
          }
        : undefined,
      onResult: (result, requestNumber) => {
        if (showProgress) clearProgress();
        console.log(formatRequestLine(result, requestNumber, REQUEST_COUNT));
      },
    });
    if (results.some((result) => result.decoded)) {
      console.error(
        "Внимание: сервер сжал ответ, хотя скрипт просил без сжатия. " +
          "Объём посчитан после распаковки, поэтому скорость сети завышена.",
      );
    }
    console.log();
    console.log(formatSummary(summarize(results)));
    return 0;
  } catch (error) {
    if (showProgress) clearProgress();
    console.error(`Ошибка: ${describeError(error)}`);
    return 1;
  }
}

process.exitCode = await main();

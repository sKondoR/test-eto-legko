import { createServer, type RequestListener } from "node:http";
import type { AddressInfo } from "node:net";

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

/** Поднимает локальный HTTP-сервер на свободном порту. */
export async function startServer(handler: RequestListener): Promise<TestServer> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
  };
}

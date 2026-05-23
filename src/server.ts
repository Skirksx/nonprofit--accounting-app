/// <reference types="node" />

import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ quiet: true });

export function resolvePort(env: NodeJS.ProcessEnv = process.env): number {
  const port = Number(env.PORT);
  return Number.isInteger(port) && port > 0 ? port : 3000;
}

const port = resolvePort();

export const server = createServer((_request, response) => {
  response.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Nonprofit Ledger server is running.");
});

export function isMainModule(metaUrl: string, argvPath = process.argv[1]): boolean {
  return fileURLToPath(metaUrl) === resolve(argvPath);
}

if (isMainModule(import.meta.url)) {
  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}

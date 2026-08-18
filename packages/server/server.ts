import "./utils/greetings";

import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { appRouter } from "server";
import { createContext } from "./auth";

const server = createHTTPServer({
  router: appRouter,
  middleware: cors(),
  createContext,
  // Up to 4 proof files × 4 MiB of base64 (~22 MiB) can land in one request
  // body; cap it so oversized payloads fail with 413 during streaming rather
  // than buffering unbounded memory before Zod rejects.
  maxBodySize: 64 * 1024 * 1024,
}).listen(parseInt(Bun.env.PORT ?? "30000", 10), Bun.env.HOSTNAME ?? "0.0.0.0");

function addr() {
  const address = server.address();
  if (typeof address === "string") {
    return address;
  }
  if (address && typeof address === "object") {
    return `http://${address.address}:${address.port}`;
  }
  return address;
}

console.log(`Server running on ${addr()}`);

import "./utils/greetings";

import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { appRouter } from "server";
import { createContext } from "./auth";

const server = createHTTPServer({
  router: appRouter,
  middleware: cors(),
  createContext,
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

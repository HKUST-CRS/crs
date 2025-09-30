import { createHTTPServer } from "@trpc/server/adapters/standalone";
import cors from "cors";
import { appRouter } from "server";

const server = createHTTPServer({
  router: appRouter,
  middleware: cors(),
}).listen(30000, "127.0.0.1");

console.log(`Server running on ${JSON.stringify(server.address())}`);

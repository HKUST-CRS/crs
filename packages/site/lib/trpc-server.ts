// biome-ignore assist/source/organizeImports: server-only
import "server-only"; // <-- ensure this file cannot be imported from the client

import { createTRPCOptionsProxy } from "@trpc/tanstack-react-query";
import { cache } from "react";
import { makeQueryClient } from "./query";
import { createTRPCClient, httpLink } from "@trpc/client";
import type { AppRouter } from "server";

// IMPORTANT: Create a stable getter for the query client that
//            will return the same client during the same request.
export const getQueryClient = cache(makeQueryClient);

const SERVER_URL = process.env.SERVER_SERVER_URL;
if (!SERVER_URL) {
  throw new Error("Missing SERVER_SERVER_URL environment variable");
}

console.log(`Server Server URL: ${SERVER_URL}`);

export const trpc = createTRPCOptionsProxy<AppRouter>({
  client: createTRPCClient({
    links: [httpLink({ url: SERVER_URL })],
  }),
  queryClient: getQueryClient,
});

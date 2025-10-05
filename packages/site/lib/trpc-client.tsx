"use client";
// ^-- to make sure we can mount the Provider from a server component
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import type { AppRouter } from "server";
import { makeQueryClient } from "./query";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

let authorization: string = "";
export function authorize(token: string) {
  authorization = `Bearer ${token}`;
}

let browserQueryClient: QueryClient;
function getQueryClient() {
  if (typeof window === "undefined") {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: make a new query client if we don't already have one
  // This is very important, so we don't re-make a new client if React
  // suspends during the initial render. This may not be needed if we
  // have a suspense boundary BELOW the creation of the query client
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export function TRPCReactProvider(
  props: Readonly<{
    children: React.ReactNode;
  }>,
) {
  const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL;
  if (!SERVER_URL) {
    throw new Error("Missing NEXT_PUBLIC_SERVER_URL environment variable");
  }

  const path = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    const token = session?.account?.id_token;
    if (token) {
      authorize(token);
    }
  }, [session]);

  // NOTE: Avoid useState when initializing the query client if you don't
  //       have a suspense boundary between this and the code that may
  //       suspend because React will throw away the client on the initial
  //       render if it suspends and there is no boundary
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          // transformer: superjson, <-- if you use a data transformer
          url: SERVER_URL,
          headers() {
            return {
              Authorization: authorization,
            };
          },
        }),
      ],
    }),
  );

  if (session || path === "/login") {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
          {props.children}
        </TRPCProvider>
      </QueryClientProvider>
    );
  } else {
    return null;
  }
}

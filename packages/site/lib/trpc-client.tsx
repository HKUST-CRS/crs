"use client";
// ^-- to make sure we can mount the Provider from a server component
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo } from "react";
import type { AppRouter } from "server";
import { makeQueryClient } from "./query";

export const { TRPCProvider, useTRPC } = createTRPCContext<AppRouter>();

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
  const path = usePathname();

  const { data: session, update } = useSession();
  // Periodically attempt to refresh by triggering a session update. On the
  // server side, the session update checks if the access token is or near
  // expiry and refreshes it if needed.
  useEffect(() => {
    const interval = setInterval(
      () => {
        console.log("Attempt to refresh access_token...");
        void update();
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(interval);
  }, [update]);

  // The provider (and thus the children) should only be rendered if we're on
  // the login page or the user has a session. This prevents components from
  // trying to use the tRPC client before even there is a session.
  const shouldRenderProvider = path === "/login" || !!session;

  const token = session?.account.access_token;

  // NOTE: Avoid useState when initializing the query client if you don't
  //       have a suspense boundary between this and the code that may
  //       suspend because React will throw away the client on the initial
  //       render if it suspends and there is no boundary
  const queryClient = getQueryClient();

  // Only create the tRPC client when we have a valid URL
  // The authorization header is retrieved dynamically from the module-level variable
  const trpcClient = useMemo(
    () =>
      createTRPCClient<AppRouter>({
        links: [
          httpBatchLink({
            url: "/api/trpc",
            headers() {
              if (!token) return {};
              return {
                Authorization: `Bearer ${token}`,
              };
            },
          }),
        ],
      }),
    [token],
  );

  // Don't render children until we have a valid tRPC client and session/login path
  // This prevents components from trying to use tRPC client before it's properly initialized
  if (shouldRenderProvider) {
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

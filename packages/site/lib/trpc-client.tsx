"use client";
// ^-- to make sure we can mount the Provider from a server component
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import { createTRPCContext } from "@trpc/tanstack-react-query";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
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
  const path = usePathname();
  const { data: session } = useSession();

  useEffect(() => {
    const token = session?.account?.id_token;
    if (token) {
      authorize(token);
    }
  }, [session]);

  const [url, setUrl] = useState<string>("");
  const [urlError, setUrlError] = useState<Error | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const MAX_RETRY_ATTEMPTS = 3;

  useEffect(() => {
    let isCancelled = false;
    let timeoutId: NodeJS.Timeout | null = null;

    async function updateUrl() {
      try {
        setUrlError(null);
        console.log("Fetching Client Server URL...");
        const url = await fetch("/api/url").then((r) => r.text());
        if (!isCancelled) {
          setUrl(url);
          console.log(`Fetch Client Server URL: ${url}`);
        }
      } catch (e) {
        console.error("Failed to fetch Client Server URL.", e);
        if (!isCancelled) {
          setUrlError(e instanceof Error ? e : new Error(String(e)));
          // Retry with exponential backoff (max 3 retries)
          if (retryCount < MAX_RETRY_ATTEMPTS) {
            const delay = Math.min(1000 * 2 ** retryCount, 4000);
            console.log(
              `Retrying in ${delay}ms... (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`,
            );
            timeoutId = setTimeout(() => {
              if (!isCancelled) {
                setRetryCount((count) => count + 1);
              }
            }, delay);
          }
        }
      }
    }
    updateUrl();

    return () => {
      isCancelled = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [retryCount]); // Re-run when retryCount changes

  // NOTE: Avoid useState when initializing the query client if you don't
  //       have a suspense boundary between this and the code that may
  //       suspend because React will throw away the client on the initial
  //       render if it suspends and there is no boundary
  const queryClient = getQueryClient();

  // Only create the tRPC client when we have a valid URL
  // The authorization header is retrieved dynamically from the module-level variable
  const trpcClient = useMemo(() => {
    if (!url) return null;

    return createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          // transformer: superjson, <-- if you use a data transformer
          url,
          headers() {
            return {
              Authorization: authorization,
            };
          },
        }),
      ],
    });
  }, [url]);

  // Don't render children until we have a valid tRPC client and session/login path
  // This prevents components from trying to use tRPC client before it's properly initialized
  if ((session || path === "/login") && trpcClient) {
    return (
      <QueryClientProvider client={queryClient}>
        <TRPCProvider trpcClient={trpcClient} queryClient={queryClient}>
          {props.children}
        </TRPCProvider>
      </QueryClientProvider>
    );
  }

  // Show error state if URL fetch failed after all retries
  if (
    (session || path === "/login") &&
    urlError &&
    retryCount >= MAX_RETRY_ATTEMPTS
  ) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h2>Failed to connect to server</h2>
        <p style={{ color: "red" }}>{urlError.message}</p>
        <button
          type="button"
          onClick={() => setRetryCount(0)}
          style={{
            padding: "0.5rem 1rem",
            marginTop: "1rem",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // Loading state or not authorized
  return null;
}

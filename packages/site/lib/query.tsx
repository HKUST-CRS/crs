import {
  defaultShouldDehydrateQuery,
  MutationCache,
  QueryCache,
  QueryClient,
} from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { showError } from "./showError";

const signOutOnClient = () => {
  if (typeof window === "undefined") return;

  void import("next-auth/react").then(({ signOut }) =>
    signOut({
      redirect: true,
      redirectTo: "/login",
    }),
  );
};

const errorHandler = (error: Error) => {
  console.error("tRPC error. ", { error });
  if (error instanceof TRPCClientError) {
    if (error.data?.jose && error.data.jose.code !== "ERR_JWT_EXPIRED") {
      // If it is a Jose Error, but not because of JWT expiration,
      // try signing out the user to force a new login.
      signOutOnClient();
    }
  }
  showError(error);
};

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
      },
      dehydrate: {
        // include pending queries in dehydration
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
    queryCache: new QueryCache({
      onError: (error) => {
        errorHandler(error);
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        errorHandler(error);
      },
    }),
  });
}

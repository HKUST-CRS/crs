import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import type { Role } from "service/models";
import { useTRPC } from "./trpc-client";

/**
 * Redirects the window to an endpoint based on the user's role.
 *
 * @param f A function that takes a set of roles and returns a redirection path or null, if no
 * redirection is needed.
 */
export const useRoleRedirection = (f: (rs: Set<Role>) => string | null) => {
  const trpc = useTRPC();

  const { data: user } = useQuery(trpc.user.get.queryOptions());

  const router = useRouter();
  useEffect(() => {
    if (user) {
      const roles = new Set(user.enrollment.map((e) => e.role));
      const redirection = f(roles);
      if (redirection) {
        router.replace(redirection);
      }
    }
  }, [user, router, f]);
};

/**
 * Redirects non-instructor users to the home page.
 */
export const useInstructorOnly = () => {
  useRoleRedirection(
    useCallback((rs) => (!rs.has("instructor") ? "/" : null), []),
  );
};

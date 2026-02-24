"use client";

import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useEffect } from "react";
import posthog from "posthog-js";
import { validateSession } from "@/lib/auth";
import { login } from "./login";

function ClientLogin() {
  const search = useSearchParams();
  const { data: session } = useSession();

  useEffect(() => {
    async function run() {
      const r = search.get("r");
      console.log(`On login page (r=${r}).`);
      if (validateSession(session)) {
        console.log("Have already logged in. Redirectiong...");
        // Identify the already-logged-in user
        const email = session?.user?.email;
        if (email) {
          posthog.identify(email, {
            email,
            name: session?.user?.name ?? undefined,
          });
        }
      } else {
        console.log("Have not yet logged in. Logging in...");
        posthog.capture("user_login_initiated", {
          redirect_to: r ?? "/",
        });
        await login(r ?? "/");
      }
    }

    void run();
  }, [search, session]);

  return null;
}

export default function Login() {
  return (
    <Suspense>
      <ClientLogin />
    </Suspense>
  );
}

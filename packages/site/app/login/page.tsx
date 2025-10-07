"use client";

import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useEffect } from "react";
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
      } else {
        console.log("Have not yet logged in. Logging in...");
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

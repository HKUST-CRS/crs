"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useEffect } from "react";
import { validateSession } from "@/lib/auth";
import { login } from "./login";

function ClientLogin() {
  const search = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    async function run() {
      console.log("On login page.");
      if (validateSession(session)) {
        const r = search.get("r");
        console.log(`Already logged in, redirecting to ${r}...`);
        if (r) {
          router.replace(r);
        } else {
          router.replace("/");
        }
      } else {
        console.log("Haven't logged in, triggering login...");
        await login();
      }
    }
    void run();
  }, [router, search, session]);

  return null;
}

export default function Login() {
  return (
    <Suspense>
      <ClientLogin />
    </Suspense>
  );
}

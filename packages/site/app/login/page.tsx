"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Suspense, useEffect } from "react";
import { login } from "./login";

function ClientLogin() {
  const search = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();

  useEffect(() => {
    async function run() {
      if (session?.user) {
        const r = search.get("r");
        if (r) {
          router.replace(r);
        } else {
          router.replace("/");
        }
      } else {
        await login();
      }
    }
    void run();
  }, [router.replace, search.get, session?.user]);

  return null;
}

export default function Login() {
  return (
    <Suspense>
      <ClientLogin />
    </Suspense>
  );
}

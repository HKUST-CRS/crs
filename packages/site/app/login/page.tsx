"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { login } from "./login";

function ClientLogin() {
  const search = useSearchParams();
  const signedOut = search.get("signedOut") === "1";

  useEffect(() => {
    if (signedOut) return;
    async function run() {
      const r = search.get("r");
      console.log(`On login page (r=${r}).`);
      await login(r ?? "/");
    }

    void run();
  }, [search, signedOut]);

  if (!signedOut) return null;

  return (
    <article className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 text-center">
      <h1 className="font-bold text-2xl">You have been signed out</h1>
      <p className="text-gray-500 text-sm">
        Your session has ended. Sign in again to continue.
      </p>
      <Button onClick={() => login("/")}>Sign in</Button>
    </article>
  );
}

export default function Login() {
  return (
    <Suspense>
      <ClientLogin />
    </Suspense>
  );
}

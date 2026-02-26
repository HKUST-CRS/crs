"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import { login } from "./login";

function ClientLogin() {
  const search = useSearchParams();

  useEffect(() => {
    async function run() {
      const r = search.get("r");
      console.log(`On login page (r=${r}).`);
      await login(r ?? "/");
    }

    void run();
  }, [search]);

  return null;
}

export default function Login() {
  return (
    <Suspense>
      <ClientLogin />
    </Suspense>
  );
}

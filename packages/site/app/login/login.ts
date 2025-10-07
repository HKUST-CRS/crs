"use server";

import { signIn } from "@/lib/auth";

export async function login(redirection: string) {
  await signIn("microsoft-entra-id", {
    redirect: true,
    redirectTo: redirection,
  });
}

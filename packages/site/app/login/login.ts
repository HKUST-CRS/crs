"use server";

import { signIn } from "@/lib/auth";

export async function login() {
  await signIn("microsoft-entra-id");
}

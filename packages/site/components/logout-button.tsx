"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  return (
    <Button
      variant="outline"
      size="sm"
      aria-label="Log out"
      onClick={() => signOut({ redirectTo: "/login?signedOut=1" })}
    >
      <LogOut />
    </Button>
  );
}

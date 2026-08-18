"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LogoutButton({ className }: { className?: string }) {
  return (
    <Button
      className={className}
      variant="outline"
      size="sm"
      aria-label="Log out"
      onClick={() => signOut({ redirectTo: "/login" })}
    >
      <LogOut />
    </Button>
  );
}

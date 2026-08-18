"use client";

import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";

export function LogoutButton({
  className,
  devAuth = false,
}: {
  className?: string;
  devAuth?: boolean;
}) {
  const { status } = useSession();
  if (!devAuth && status !== "authenticated") return null;

  return (
    <Button
      className={className}
      variant="outline"
      size="sm"
      aria-label="Log out"
      onClick={() => void signOut({ redirectTo: "/login" })}
    >
      <LogOut />
    </Button>
  );
}

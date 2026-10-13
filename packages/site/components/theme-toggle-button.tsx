"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/ThemeProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggleButton({ className }: { className?: string }) {
  const { handleThemeChange } = useTheme();

  return (
    <Button
      className={cn("fixed top-4 right-4 z-[8]", className)}
      variant="outline"
      size="sm"
      aria-label="Toggle theme"
      onClick={handleThemeChange}
    >
      <Sun aria-hidden="true" className="hidden text-yellow-400 dark:block" />
      <Moon aria-hidden="true" className="text-blue-800 dark:hidden" />
    </Button>
  );
}

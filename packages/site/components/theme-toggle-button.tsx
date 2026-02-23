"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/app/ThemeProvider";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function ThemeToggleButton({ className }: { className?: string }) {
  const { theme, handleThemeChange } = useTheme();

  return (
    <Button
      className={cn("absolute top-4 right-4", className)}
      variant="outline"
      size="sm"
      aria-label="Toggle theme"
      onClick={handleThemeChange}
    >
      {theme === "dark" ? (
        <Sun className="text-yellow-400" />
      ) : (
        <Moon className="text-blue-800" />
      )}
    </Button>
  );
}

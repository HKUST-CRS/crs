"use client";

import { ChevronLeft, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { Button } from "@/components/ui/button";
import RequestForm from "../../components/requests/request-form";
import { useTheme } from "../ThemeProvider";

export default function Home() {
  const { isDark, handleThemeChange } = useTheme();

  return (
    <article className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-4">
      <ThemeToggleButton />
      <Link href="/" className="self-start">
        <Button variant="ghost" size="icon">
          <ChevronLeft className="size-6" />
        </Button>
      </Link>
      <h3 className="typo-h3">Request</h3>
      <RequestForm />
    </article>
  );
}

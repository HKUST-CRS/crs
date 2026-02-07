"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import RequestForm from "../../components/requests/request-form";
import { useTheme } from "../ThemeProvider";
import { Sun, Moon } from "lucide-react";

export default function Home() {
  const { isDark, handleThemeChange } = useTheme();
  

  return (
    <article className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-4">
      <Button
          className="absolute right-4 top-4 md:right-8 md:top-8"
          variant="outline"
          size="sm"
          onClick={() => handleThemeChange()}
        >
          {isDark ? <Sun className="text-yellow-500" /> : <Moon className="text-blue-750" />}
      </Button>
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

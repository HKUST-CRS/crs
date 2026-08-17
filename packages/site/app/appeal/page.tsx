"use client";

import { ChevronLeft, FilePlus } from "lucide-react";
import Link from "next/link";
import { AppealList } from "@/components/appeal/appeal-list";
import { Button } from "@/components/ui/button";

export default function ListPage() {
  return (
    <article className="mx-auto mb-10 flex min-h-screen max-w-4xl flex-col items-center justify-center gap-4 md:mb-0">
      <Link href="/" className="self-start">
        <Button variant="ghost" size="icon">
          <ChevronLeft className="size-6" />
        </Button>
      </Link>
      <h3 className="typo-h3">My Appeals</h3>
      <Link href="/appeal/new">
        <Button className="cursor-pointer">
          <FilePlus /> New Appeal
        </Button>
      </Link>
      <AppealList />
    </article>
  );
}

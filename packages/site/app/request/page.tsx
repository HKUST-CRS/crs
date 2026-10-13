"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import RequestForm from "../../components/requests/request-form";

export default function Home() {
  return (
    <article className="mx-auto mb-10 flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-4 px-4 py-8 md:mb-0">
      <Button asChild variant="ghost" size="icon" className="self-start">
        <Link href="/" aria-label="Back to requests">
          <ChevronLeft className="size-6" />
        </Link>
      </Button>
      <h3 className="typo-h3">Request</h3>
      <RequestForm className="w-full" />
    </article>
  );
}

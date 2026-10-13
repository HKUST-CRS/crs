"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import RequestForm from "../../components/requests/request-form";

export default function Home() {
  return (
    <article className="mx-auto mb-10 flex min-h-screen max-w-4xl flex-col items-center justify-center gap-4 md:mb-0">
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

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import RequestDisplay from "./request-display";

export default async function ({
  params,
  searchParams,
}: {
  params: Promise<{ requestID: string }>;
  searchParams?: Promise<{ from?: string | string[] }>;
}) {
  const requestID = (await params).requestID;
  const from = (await searchParams)?.from;
  const backHref = from === "instructor" ? "/instructor" : "/";

  return (
    <article className="mx-auto flex min-h-screen w-full max-w-4xl flex-col items-center justify-center gap-4 px-4 py-8">
      <Button asChild variant="ghost" size="icon" className="self-start">
        <Link href={backHref} aria-label="Back to requests">
          <ChevronLeft className="size-6" />
        </Link>
      </Button>
      <h3 className="typo-h3 text-center">Request</h3>
      <RequestDisplay requestID={requestID} />
    </article>
  );
}

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import RequestDisplay from "./request-display";

export default async function ({
  params,
}: {
  params: Promise<{ requestID: string }>;
}) {
  const requestID = (await params).requestID;

  return (
    <article className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-4">
      <Link href="/" className="self-start">
        <Button variant="ghost" size="icon">
          <ChevronLeft className="size-6" />
        </Button>
      </Link>
      <h3 className="typo-h3 text-center">Response</h3>
      <RequestDisplay requestID={requestID} />
    </article>
  );
}

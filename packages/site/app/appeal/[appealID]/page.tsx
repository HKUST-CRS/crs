import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { AppealThread } from "@/components/appeal/appeal-thread";
import { Button } from "@/components/ui/button";

export default async function ({
  params,
}: {
  params: Promise<{ appealID: string }>;
}) {
  const appealID = (await params).appealID;

  return (
    <article className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-4">
      <Link href="/appeal" className="self-start">
        <Button variant="ghost" size="icon">
          <ChevronLeft className="size-6" />
        </Button>
      </Link>
      <h3 className="typo-h3 text-center">Response</h3>
      <AppealThread appealID={appealID} />
    </article>
  );
}

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
    <article className="mx-auto flex h-screen max-w-4xl flex-col">
      <header className="flex items-center gap-2 px-4 py-3">
        <Link href="/appeal">
          <Button variant="ghost" size="icon">
            <ChevronLeft className="size-6" />
          </Button>
        </Link>
        <h3 className="typo-h3">Appeal</h3>
      </header>
      <AppealThread appealID={appealID} className="min-h-0 flex-1" />
    </article>
  );
}

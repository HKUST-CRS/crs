import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { AppealParticipants } from "@/components/appeal/appeal-participants";
import { Button } from "@/components/ui/button";

export default async function ({
  params,
}: {
  params: Promise<{ appealID: string }>;
}) {
  const appealID = (await params).appealID;

  return (
    <article className="mx-auto mb-10 flex min-h-screen max-w-4xl flex-col gap-4">
      <header className="flex items-center gap-2 px-4 py-3">
        <Link href={`/appeal/${appealID}`}>
          <Button variant="ghost" size="icon">
            <ChevronLeft className="size-6" />
          </Button>
        </Link>
        <h3 className="typo-h3">Participants</h3>
      </header>
      <AppealParticipants appealID={appealID} />
    </article>
  );
}

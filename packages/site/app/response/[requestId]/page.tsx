import ResponseDisplay from "./response-display";

export default async function ({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const requestId = (await params).requestId;

  return (
    <article className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center gap-4">
      <h3 className="typo-h3">New Response</h3>
      <ResponseDisplay requestId={requestId} />
    </article>
  );
}

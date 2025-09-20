import { findRequest } from "@/components/_test-data";
import ResponseForm from "@/components/requests/response-form";

export default async function ({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const requestId = (await params).requestId;
  const request = findRequest(requestId);
  if (!request) {
    console.error({
      message: "Request not found",
      requestId,
    });
    return null;
  }

  return (
    <article className="max-w-4xl mx-auto flex flex-col gap-4 items-center justify-center min-h-screen">
      <h3 className="typo-h3">New Response</h3>
      <ResponseForm request={request} />
    </article>
  );
}

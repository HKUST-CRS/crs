import { findRequest } from "@/components/_test-data";
import ResponseForm from "../../../components/requests/response-form";

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
    <article className="mx-auto flex min-h-screen max-w-4xl flex-col items-center justify-center">
      <h3 className="typo-h3">View Request</h3>
      <ResponseForm request={request} viewonly />
    </article>
  );
}

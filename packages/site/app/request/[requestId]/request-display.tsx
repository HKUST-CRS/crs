"use client";

import { useQuery } from "@tanstack/react-query";
import RequestForm from "@/components/requests/request-form";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc-client";

export default function RequestDisplay({ requestID }: { requestID: string }) {
  const trpc = useTRPC();
  const requestQuery = useQuery(trpc.request.get.queryOptions(requestID));
  if (requestQuery.error) {
    console.error({
      error: requestQuery.error,
      requestID,
    });
    return null;
  }
  return (
    <div className="m-4">
      {requestQuery.data ? (
        <RequestForm default={requestQuery.data} viewonly />
      ) : (
        <Spinner variant="ellipsis" />
      )}
    </div>
  );
}

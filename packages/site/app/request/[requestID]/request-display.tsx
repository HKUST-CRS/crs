"use client";

import { useQuery } from "@tanstack/react-query";
import RequestThread from "@/components/requests/request-thread";
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
    return (
      <p role="alert">
        Could not load this request: {requestQuery.error.message}
      </p>
    );
  }
  return (
    <div className="w-full min-w-0">
      {requestQuery.data ? (
        <RequestThread request={requestQuery.data} />
      ) : (
        <Spinner variant="ellipsis" />
      )}
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import RequestThread from "@/components/requests/request-thread";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc-client";

export default function ResponseDisplay({ requestID }: { requestID: string }) {
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
        <RequestThread request={requestQuery.data} />
      ) : (
        <Spinner variant="ellipsis" />
      )}
    </div>
  );
}

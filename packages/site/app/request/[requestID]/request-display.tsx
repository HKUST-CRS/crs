"use client";

import { useQuery } from "@tanstack/react-query";
import { QueryError } from "@/components/query-error";
import RequestThread from "@/components/requests/request-thread";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc-client";

export default function RequestDisplay({ requestID }: { requestID: string }) {
  const trpc = useTRPC();
  const requestQuery = useQuery(trpc.request.get.queryOptions(requestID));
  if (requestQuery.error) {
    return (
      <QueryError
        message="Could not load this request. It may be unavailable, or you may not have access."
        onRetry={() => void requestQuery.refetch()}
        isRetrying={requestQuery.isFetching}
      />
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

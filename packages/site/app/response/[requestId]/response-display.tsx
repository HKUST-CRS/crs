"use client";

import { useQuery } from "@tanstack/react-query";
import ResponseForm from "@/components/requests/response-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc-client";

export default function ResponseDisplay({ requestId }: { requestId: string }) {
  const trpc = useTRPC();
  const requestQuery = useQuery(trpc.request.get.queryOptions(requestId));
  if (requestQuery.error) {
    console.error({
      error: requestQuery.error,
      requestId,
    });
    return null;
  }
  if (requestQuery.data) {
    return <ResponseForm request={requestQuery.data} />;
  } else {
    return <Skeleton />;
  }
}

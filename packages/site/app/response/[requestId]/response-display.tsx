"use client";

import { useQuery } from "@tanstack/react-query";
import ResponseForm from "@/components/requests/response-form";
import { Spinner } from "@/components/ui/spinner";
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
    if (requestQuery.data.response) {
      return (
        <ResponseForm
          request={requestQuery.data}
          onSubmit={requestQuery.refetch}
          viewonly
        />
      );
    } else {
      return (
        <ResponseForm
          request={requestQuery.data}
          onSubmit={requestQuery.refetch}
        />
      );
    }
  } else {
    return <Spinner variant="ellipsis" />;
  }
}

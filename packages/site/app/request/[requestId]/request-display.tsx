"use client";

import { useQuery } from "@tanstack/react-query";
import RequestForm from "@/components/requests/request-form";
import ResponseForm from "@/components/requests/response-form";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc-client";

export default function RequestDisplay({ requestId }: { requestId: string }) {
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
      return <ResponseForm request={requestQuery.data} viewonly />;
    } else {
      return <RequestForm default={requestQuery.data} viewonly />;
    }
  } else {
    return <Spinner variant="ellipsis" />;
  }
}

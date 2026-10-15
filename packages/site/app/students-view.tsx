"use client";

import { useQuery } from "@tanstack/react-query";
import { FilePlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { QueryError } from "@/components/query-error";
import { RequestTable } from "@/components/requests/request-table";
import TextType from "@/components/TextType";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc-client";
import { useWindowFocus } from "@/lib/useWindowFocus";
import { DYK } from "./dyk";

export default function StudentsView() {
  const router = useRouter();

  const trpc = useTRPC();

  const userQuery = useQuery(trpc.user.getCurrent.queryOptions());

  // Redirection
  const hasStudentRole = userQuery.data?.enrollment?.some(
    (e) => e.role === "student",
  );
  const hasTeachingRole = userQuery.data?.enrollment?.some(
    (e) =>
      e.role === "instructor" ||
      e.role === "observer" ||
      e.role === "grader" ||
      e.role === "admin",
  );
  useEffect(() => {
    if (userQuery.data !== undefined && !hasStudentRole && hasTeachingRole) {
      router.replace("/instructor");
    }
  }, [router, userQuery.data, hasStudentRole, hasTeachingRole]);

  // Requests
  const requestsQuery = useQuery(
    trpc.request.getAllAs.queryOptions(["student"]),
  );
  const requests = requestsQuery.data;

  useWindowFocus(
    useCallback(() => {
      userQuery.refetch();
      requestsQuery.refetch();
    }, [userQuery, requestsQuery]),
  );

  return (
    <article className="mx-auto my-16 flex w-full max-w-4xl flex-col gap-8 px-4 lg:my-32">
      <DYK />
      <header className="text-center">
        <h1>CRS</h1>
        <TextType
          text="CSE Request System"
          as="div"
          textColors={["var(--foreground)"]}
          cursorCharacter="_"
          variableSpeed={{
            min: 120,
            max: 240,
          }}
        />
        <div className="text-muted-foreground text-xs">
          (Students' View)
          {hasTeachingRole && (
            <>
              <br />
              Alternatively, click for{" "}
              <u>
                <Link href="/instructor">Staff View</Link>
              </u>
            </>
          )}
        </div>
      </header>
      <section className="mx-auto">
        <Button asChild className="cursor-pointer">
          <Link href="/request">
            <FilePlus /> New Request
          </Link>
        </Button>
      </section>
      <section>
        <p className="pb-4 font-medium text-sm leading-none">My Requests</p>
        {requestsQuery.error ? (
          <QueryError
            message="Could not load your requests."
            onRetry={() => void requestsQuery.refetch()}
            isRetrying={requestsQuery.isFetching}
          />
        ) : requests ? (
          <RequestTable
            data={requests}
            getRequestHref={(request) => `/request/${request.id}`}
          />
        ) : (
          <Spinner variant="ellipsis" />
        )}
      </section>
    </article>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { columns } from "@/components/requests/columns";
import { DataTable } from "@/components/requests/data-table";
import TextType from "@/components/TextType";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc-client";
import { useWindowFocus } from "@/lib/useWindowFocus";

export default function InstructorsView() {
  const router = useRouter();

  const trpc = useTRPC();

  const userQuery = useQuery(trpc.user.get.queryOptions());
  const instructorRequestsQuery = useQuery(
    trpc.request.getAll.queryOptions("instructor"),
  );
  const taRequestsQuery = useQuery(trpc.request.getAll.queryOptions("ta"));
  const requests = instructorRequestsQuery.data &&
    taRequestsQuery.data && [
      ...instructorRequestsQuery.data,
      ...taRequestsQuery.data,
    ];

  const hasStudentRole = userQuery.data?.enrollment?.some((e) => {
    return e.role === "student";
  });
  const hasTeachingRole = userQuery.data?.enrollment?.some((e) => {
    return e.role === "instructor" || e.role === "ta";
  });

  useEffect(() => {
    if (
      hasStudentRole !== undefined &&
      hasStudentRole &&
      hasTeachingRole !== undefined &&
      !hasTeachingRole
    ) {
      router.replace("/");
    }
  }, [router, hasStudentRole, hasTeachingRole]);

  useWindowFocus(
    useCallback(() => {
      instructorRequestsQuery.refetch();
      taRequestsQuery.refetch();
    }, [instructorRequestsQuery, taRequestsQuery]),
  );

  return (
    <article className="mx-auto my-32 flex max-w-4xl flex-col gap-8 lg:my-64">
      <header className="text-center">
        <h1>CRS</h1>
        <TextType
          text="CSE Request System"
          as="div"
          textColors={["#000000"]}
          cursorCharacter="_"
          variableSpeed={{
            min: 120,
            max: 240,
          }}
        />
        <div className="text-gray-500 text-xs">
          (Instructors' View){" "}
          {hasStudentRole && (
            <>
              <br />
              Alternatively, click for{" "}
              <u>
                <Link href="/">Student's View</Link>
              </u>
            </>
          )}
        </div>
      </header>
      <section>
        <p className="pb-4 font-medium text-sm leading-none">
          Received Requests
        </p>
        {requests ? (
          <DataTable
            columns={columns}
            data={requests}
            onClick={(request) => {
              router.push(`/response/${request.id}`);
            }}
          />
        ) : (
          <Spinner variant="ellipsis" />
        )}
      </section>
    </article>
  );
}

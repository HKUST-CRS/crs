"use client";

import { useQuery } from "@tanstack/react-query";
import { FilePlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { columns } from "@/components/requests/columns";
import { DataTable } from "@/components/requests/data-table";
import TextType from "@/components/TextType";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc-client";
import { useWindowFocus } from "@/lib/useWindowFocus";

export default function StudentsView() {
  const router = useRouter();

  const trpc = useTRPC();

  const userQuery = useQuery(trpc.user.get.queryOptions());
  const requestsQuery = useQuery(trpc.request.getAll.queryOptions("student"));
  const requests = requestsQuery.data;

  const hasStudentRole = userQuery.data?.enrollment?.some((e) => {
    return e.role === "student";
  });
  const hasTeachingRole = userQuery.data?.enrollment?.some((e) => {
    return e.role === "instructor" || e.role === "ta";
  });

  useEffect(() => {
    if (
      hasStudentRole !== undefined &&
      !hasStudentRole &&
      hasTeachingRole !== undefined &&
      hasTeachingRole
    ) {
      router.replace("/instructor");
    }
  }, [router, hasStudentRole, hasTeachingRole]);

  useWindowFocus(
    useCallback(() => {
      userQuery.refetch();
      requestsQuery.refetch();
    }, [userQuery, requestsQuery]),
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
          (Students' View)
          {hasTeachingRole && (
            <>
              <br />
              Alternatively, click for{" "}
              <u>
                <Link href="/instructor">Instructor's View</Link>
              </u>
            </>
          )}
        </div>
      </header>
      <section className="mx-auto">
        <Link href="/request">
          <Button className="cursor-pointer">
            <FilePlus /> New Request
          </Button>
        </Link>
      </section>
      <section>
        <p className="pb-4 font-medium text-sm leading-none">My Requests</p>
        {requests ? (
          <DataTable
            columns={columns}
            data={requests}
            onClick={(request) => {
              router.push(`/request/${request.id}`);
            }}
          />
        ) : (
          <Spinner variant="ellipsis" />
        )}
      </section>
    </article>
  );
}

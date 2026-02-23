"use client";

import { useQuery } from "@tanstack/react-query";
import { FilePlus, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect } from "react";
import { RequestTable } from "@/components/requests/request-table";
import TextType from "@/components/TextType";
import { ThemeToggleButton } from "@/components/theme-toggle-button";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc-client";
import { useWindowFocus } from "@/lib/useWindowFocus";
import { DYK } from "./dyk";
import { useTheme } from "./ThemeProvider";

export default function StudentsView() {
  const { isDark, handleThemeChange } = useTheme();

  const router = useRouter();

  const trpc = useTRPC();

  const userQuery = useQuery(trpc.user.getCurrent.queryOptions());

  // Redirection
  const hasStudentRole = userQuery.data?.enrollment?.some(
    (e) => e.role === "student",
  );
  const hasTeachingRole = userQuery.data?.enrollment?.some(
    (e) =>
      e.role === "instructor" || e.role === "observer" || e.role === "admin",
  );
  useEffect(() => {
    if (userQuery.data !== undefined && !hasStudentRole && hasTeachingRole) {
      router.replace("/instructor");
    }
  }, [router, userQuery, hasStudentRole, hasTeachingRole]);

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
    <article className="mx-auto my-32 flex max-w-4xl flex-col gap-8 lg:my-64">
      <ThemeToggleButton />
      <DYK />
      <header className="text-center">
        <Button
          className="absolute top-4 right-4 md:top-8 md:right-8"
          variant="outline"
          size="sm"
          onClick={() => handleThemeChange()}
        >
          {isDark ? (
            <Sun className="text-yellow-500" />
          ) : (
            <Moon className="text-blue-750" />
          )}
        </Button>

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
          <RequestTable
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

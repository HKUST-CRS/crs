"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";
import { Courses } from "service/models";
import { CourseSettings } from "@/components/instructor/admin/course-settings";
import { EnrollmentManager } from "@/components/instructor/admin/enrollment-manager";
import { QueryError } from "@/components/query-error";
import TextType from "@/components/TextType";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc-client";
import { useAdminOnly } from "@/lib/useRoleRedirection";

export default function Page({ params }: { params: Promise<{ cid: string }> }) {
  useAdminOnly();

  const { cid: cidRaw } = use(params);
  const cid = decodeURIComponent(cidRaw);
  const courseID = Courses.str2id(cid);

  const trpc = useTRPC();
  const courseQuery = useQuery(trpc.course.get.queryOptions(courseID));
  const course = courseQuery.data;

  return (
    <article className="mx-auto my-16 flex w-full max-w-4xl flex-col gap-8 px-4 lg:my-32">
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
        {course && (
          <div className="text-muted-foreground text-xs">
            (Admin View for {Courses.formatCourse(course)})
            <br />
            Alternatively, click for{" "}
            <u>
              <Link href="/instructor">Instructors' View</Link>
            </u>
          </div>
        )}
      </header>
      <section>
        <p className="pb-4 font-medium text-sm leading-none">
          Course Configuration
        </p>
        {courseQuery.error ? (
          <QueryError
            message="Could not load this course."
            onRetry={() => void courseQuery.refetch()}
            isRetrying={courseQuery.isFetching}
          />
        ) : course ? (
          <CourseSettings cid={courseID} />
        ) : (
          <Spinner variant="ellipsis" />
        )}
      </section>
      <section hidden={!!courseQuery.error}>
        <p className="pb-4 font-medium text-sm leading-none">Enrollments</p>
        {course ? (
          <EnrollmentManager cid={courseID} />
        ) : (
          <Spinner variant="ellipsis" />
        )}
      </section>
    </article>
  );
}

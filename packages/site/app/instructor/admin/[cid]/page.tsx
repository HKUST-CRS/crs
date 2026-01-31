"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { use } from "react";
import { Courses } from "service/models";
import { CourseSettings } from "@/components/instructor/admin/course-settings";
import { EnrollmentManager } from "@/components/instructor/admin/enrollment-manager";
import TextType from "@/components/TextType";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc-client";
import { useAdminOnly } from "@/lib/useRoleRedirection";

export default function Page({ params }: { params: Promise<{ cid: string }> }) {
  useAdminOnly();

  const { cid: cidRaw } = use(params);
  const cid = decodeURIComponent(cidRaw);

  const trpc = useTRPC();
  const { data: course } = useQuery(
    trpc.course.get.queryOptions(Courses.str2id(cid)),
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
        {course && (
          <div className="text-gray-500 text-xs">
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
        {course ? (
          <CourseSettings cid={course} />
        ) : (
          <Spinner variant="ellipsis" />
        )}
      </section>
      <section>
        <p className="pb-4 font-medium text-sm leading-none">Enrollments</p>
        {course ? (
          <EnrollmentManager cid={course} />
        ) : (
          <Spinner variant="ellipsis" />
        )}
      </section>
    </article>
  );
}

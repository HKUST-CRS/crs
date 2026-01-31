"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Courses } from "service/models";
import {
  CourseForm,
  type CourseFormSchema,
} from "@/components/instructor/course-form";
import { columns } from "@/components/requests/columns";
import { DataTable } from "@/components/requests/data-table";
import TextType from "@/components/TextType";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc-client";
import { useWindowFocus } from "@/lib/useWindowFocus";

export default function InstructorsView() {
  const router = useRouter();

  const trpc = useTRPC();

  const userQuery = useQuery(trpc.user.get.queryOptions());

  // Redirection
  const hasStudentRole = userQuery.data?.enrollment?.some(
    (e) => e.role === "student",
  );
  const hasTeachingRole = userQuery.data?.enrollment?.some(
    (e) =>
      e.role === "instructor" || e.role === "observer" || e.role === "admin",
  );
  useEffect(() => {
    if (userQuery.data !== undefined && hasStudentRole && !hasTeachingRole) {
      router.replace("/");
    }
  }, [router, userQuery, hasStudentRole, hasTeachingRole]);

  // Requests
  const requestsQuery = useQuery(
    trpc.request.getAllAs.queryOptions(["instructor", "observer"]),
  );
  const requests = requestsQuery.data;

  // Courses
  const coursesQuery = useQuery(
    trpc.course.getAllFromEnrollment.queryOptions(["instructor", "admin"]),
  );
  const courses = coursesQuery.data;

  useWindowFocus(
    useCallback(() => {
      userQuery.refetch();
      requestsQuery.refetch();
      coursesQuery.refetch();
    }, [userQuery, requestsQuery, coursesQuery]),
  );

  const createCourseMutation = useMutation(
    trpc.course.create.mutationOptions(),
  );
  const [isCourseCreationOpen, setCourseCreationOpen] = useState(false);
  const handleCreateCourse = (form: CourseFormSchema) => {
    createCourseMutation.mutate(
      {
        code: form.code,
        term: form.term,
        title: form.title,
        sections: {},
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Deadline Extension": true,
        },
      },
      {
        onSuccess: (cid) => {
          router.push(`/instructor/admin/${Courses.id2str(cid)}`);
        },
      },
    );
  };

  return (
    <article className="mx-auto my-32 flex max-w-4xl flex-col gap-8 lg:my-64">
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
      <section>
        <div className="flex flex-row items-end justify-between pb-4">
          <p className="font-medium text-sm leading-none">Course Management</p>
          {userQuery.data?.sudoer && (
            <Button onClick={() => setCourseCreationOpen(true)} size="sm">
              <Plus className="mr-2 h-4 w-4" /> Create Course
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {courses ? (
            courses.map((course) => {
              return (
                <Link
                  key={Courses.id2str(course)}
                  href={`/instructor/admin/${Courses.id2str(course)}`}
                >
                  <Card>
                    <CardContent>
                      <p className="font-medium">{Courses.formatID(course)}</p>
                      <p className="text-sm">{course.title}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })
          ) : (
            <Spinner variant="ellipsis" />
          )}
        </div>

        <Dialog
          open={isCourseCreationOpen}
          onOpenChange={setCourseCreationOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Course</DialogTitle>
            </DialogHeader>
            <CourseForm onSubmit={handleCreateCourse} />
          </DialogContent>
        </Dialog>
      </section>
    </article>
  );
}

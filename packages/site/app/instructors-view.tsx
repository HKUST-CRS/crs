"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRightFromLine, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Courses, RequestSerialization } from "service/models";
import {
  CreateCourseForm,
  type CreateCourseFormSchema,
} from "@/components/instructor/create-course-form";
import {
  ExportRequestsForm,
  type ExportRequestsFormSchema,
} from "@/components/instructor/export-requests-form";
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
import { download } from "@/lib/download";
import { useTRPC } from "@/lib/trpc-client";
import { useWindowFocus } from "@/lib/useWindowFocus";
import {Button} from "@/components/ui/button";
import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";

export default function InstructorsView() {
  
  const { isDark, handleThemeChange } = useTheme();

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

  // Export Requests (Dialog)
  const [isExportRequestsOpen, setExportRequestsOpen] = useState(false);
  const handleExportRequests = (form: ExportRequestsFormSchema) => {
    const requestsToExport = (requests ?? []).filter(
      (c) => Courses.id2str(c.class.course) === Courses.id2str(form.course),
    );
    const csv = RequestSerialization.toCSV(
      requestsToExport,
      window.location.origin,
    );

    download(
      `${Courses.formatID(form.course)}-requests.csv`,
      new Blob([csv], { type: "text/csv" }),
    );

    setExportRequestsOpen(false);
  };

  // Create Course (Dialog)
  const [isCreateCourseOpen, setCreateCourseOpen] = useState(false);
  const createCourseMutation = useMutation(
    trpc.course.create.mutationOptions(),
  );
  const handleCreateCourse = (form: CreateCourseFormSchema) => {
    createCourseMutation.mutate(
      {
        code: form.code,
        term: form.term,
        title: form.title,
        sections: {},
        assignments: {},
        effectiveRequestTypes: {
          "Swap Section": true,
          "Absent from Section": true,
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

        <Button
          className="absolute right-4 top-4 md:right-8 md:top-8"
          variant="outline"
          size="sm"
          onClick={() => handleThemeChange()}
        >
          {isDark ? <Sun className="text-yellow-500" /> : <Moon className="text-blue-750" />}
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
        <div className="flex flex-row items-end justify-between pb-4">
          <p className="font-medium text-sm leading-none">Received Requests</p>
          <Button onClick={() => setExportRequestsOpen(true)} size="sm">
            <ArrowRightFromLine className="h-4 w-4" /> Export Requests
          </Button>
        </div>

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

        <Dialog
          open={isExportRequestsOpen}
          onOpenChange={setExportRequestsOpen}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Export Requests</DialogTitle>
            </DialogHeader>
            <ExportRequestsForm onSubmit={handleExportRequests} />
          </DialogContent>
        </Dialog>
      </section>
      <section>
        <div className="flex flex-row items-end justify-between pb-4">
          <p className="font-medium text-sm leading-none">Course Management</p>
          {userQuery.data?.sudoer && (
            <Button onClick={() => setCreateCourseOpen(true)} size="sm">
              <Plus className="h-4 w-4" /> Create Course
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

        <Dialog open={isCreateCourseOpen} onOpenChange={setCreateCourseOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Course</DialogTitle>
            </DialogHeader>
            <CreateCourseForm onSubmit={handleCreateCourse} />
          </DialogContent>
        </Dialog>
      </section>
    </article>
  );
}

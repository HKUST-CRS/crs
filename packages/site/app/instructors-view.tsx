"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRightFromLine, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Courses, RequestSerialization } from "service/models";
import { toast } from "sonner";
import {
  type CourseCreationSubmission,
  CreateCourseForm,
} from "@/components/instructor/create-course-form";
import {
  RequestTable,
  type RequestTableHandle,
} from "@/components/requests/request-table";
import TextType from "@/components/TextType";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { download } from "@/lib/download";
import { useTRPC } from "@/lib/trpc-client";
import { useWindowFocus } from "@/lib/useWindowFocus";

export default function InstructorsView() {
  const router = useRouter();

  const trpc = useTRPC();
  const queryClient = useQueryClient();

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
    if (userQuery.data !== undefined && hasStudentRole && !hasTeachingRole) {
      router.replace("/");
    }
  }, [router, userQuery, hasStudentRole, hasTeachingRole]);

  // Requests
  const requestsQuery = useQuery(
    trpc.request.getAllAs.queryOptions(["instructor", "observer"]),
  );
  const requests = requestsQuery.data;
  const tableRef = useRef<RequestTableHandle>(null);

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

  // Export Requests
  const [isExporting, setExporting] = useState(false);
  const handleExportRequests = async () => {
    const requestIDs = tableRef.current?.getExportIDs() ?? [];
    setExporting(true);
    try {
      const rs = await queryClient.fetchQuery(
        trpc.request.getAllByID.queryOptions(requestIDs),
      );
      const csv = RequestSerialization.toCSV(rs, window.location.origin);

      download("requests.csv", new Blob([csv], { type: "text/csv" }));
    } finally {
      setExporting(false);
    }
  };

  // Create Course (Dialog)
  const [isCreateCourseOpen, setCreateCourseOpen] = useState(false);
  const createCourseMutation = useMutation(
    trpc.course.create.mutationOptions(),
  );
  const createEnrollmentMutation = useMutation(
    trpc.user.createEnrollment.mutationOptions(),
  );
  const suggestUserNameMutation = useMutation(
    trpc.user.suggestName.mutationOptions(),
  );
  const handleCreateCourse = async (submission: CourseCreationSubmission) => {
    try {
      const cid = await createCourseMutation.mutateAsync(submission.course);

      if (submission.kind === "automatic") {
        const results = await Promise.allSettled(
          submission.instructors.map(async (instructor) => {
            await Promise.all(
              instructor.sections.map((section) =>
                createEnrollmentMutation.mutateAsync({
                  uid: instructor.email,
                  enrollment: { course: cid, section, role: "instructor" },
                }),
              ),
            );
            await suggestUserNameMutation.mutateAsync({
              uid: instructor.email,
              name: instructor.name,
            });
          }),
        );
        if (results.some((result) => result.status === "rejected")) {
          toast.warning(
            "Course created, but some instructor enrollments need review.",
          );
        }
      }

      router.push(`/instructor/admin/${Courses.id2str(cid)}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Course creation failed.",
      );
    }
  };

  return (
    <article className="mx-auto my-16 flex max-w-4xl flex-col gap-8 md:my-32 lg:my-64">
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
        <div className="flex flex-row flex-wrap items-end justify-between gap-y-2 pb-4">
          <p className="font-medium text-sm leading-none">Received Requests</p>
          <Button
            onClick={() => void handleExportRequests()}
            size="sm"
            className="whitespace-nowrap"
            disabled={isExporting}
          >
            <ArrowRightFromLine className="h-4 w-4" />
            {isExporting ? "Exporting..." : "Export Requests"}
          </Button>
        </div>

        {requests ? (
          <RequestTable
            ref={tableRef}
            data={requests}
            onClick={(request) => {
              router.push(`/request/${request.id}?from=instructor`);
            }}
          />
        ) : (
          <Spinner variant="ellipsis" />
        )}
      </section>
      <section>
        <div className="flex flex-row flex-wrap items-end justify-between gap-y-2 pb-4">
          <p className="font-medium text-sm leading-none">Course Management</p>
          {userQuery.data?.sudoer && (
            <Button onClick={() => setCreateCourseOpen(true)} size="sm">
              <Plus className="h-4 w-4" /> Create Course
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
          <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
            <DialogHeader>
              <DialogTitle>Create Course</DialogTitle>
            </DialogHeader>
            <CreateCourseForm onSubmit={handleCreateCourse} />
            <DialogDescription className="border-t pt-4">
              Guide to <strong>Import Schedule</strong>. After entering the code
              and the term, it looks up the course in HKUST's public schedule
              and fills in its title, sections, and instructors; for safety
              reasons, the emails of the instructors have to be provided
              explicitly. Otherwise, just enter the code, the term, and the
              title manually and then configure the sections and instructors
              later.
            </DialogDescription>
          </DialogContent>
        </Dialog>
      </section>
    </article>
  );
}

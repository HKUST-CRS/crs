"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  type CourseID,
  Courses,
  type Enrollment,
  Enrollments,
} from "service/models";
import { compareString } from "service/utils/comparison";
import { toast } from "sonner";
import { QueryError } from "@/components/query-error";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldDescription } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc-client";
import {
  AddEnrollmentForm,
  type AddEnrollmentSubmissionSchema,
} from "./add-enrollment-form";
import {
  EnrollmentTable,
  type EnrollmentTableHandle,
} from "./enrollment-table";
import {
  ImportEnrollmentForm,
  type ImportEnrollmentSubmissionSchema,
} from "./import-enrollment-form";

export function EnrollmentManager({ cid }: { cid: CourseID }) {
  const trpc = useTRPC();

  const usersQuery = useQuery(trpc.user.getAllFromCourse.queryOptions(cid));
  const enrollments = (usersQuery.data ?? [])
    .flatMap((u) =>
      u.enrollment
        .filter((e) => Courses.id2str(e.course) === Courses.id2str(cid))
        .map((e) => ({ user: u, enrollment: e })),
    )
    .sort((a, b) => {
      const enrollmentCompare = Enrollments.compare(a.enrollment, b.enrollment);
      if (enrollmentCompare !== 0) {
        return enrollmentCompare;
      }
      return compareString(a.user.email, b.user.email);
    });
  const [selection, setSelection] = useState<typeof enrollments>([]);
  const tableRef = useRef<EnrollmentTableHandle>(null);

  const createEnrollmentMutation = useMutation(
    trpc.user.createEnrollment.mutationOptions(),
  );
  const deleteEnrollmentMutation = useMutation(
    trpc.user.deleteEnrollment.mutationOptions(),
  );
  const suggestUserNameMutation = useMutation(
    trpc.user.suggestName.mutationOptions(),
  );

  const createEnrollments = async (
    data: { uid: string; name: string; enrollment: Enrollment }[],
  ) => {
    const results = await Promise.allSettled(
      data.map(async ({ uid, name, enrollment }) => {
        await createEnrollmentMutation.mutateAsync({ uid, enrollment });
        await suggestUserNameMutation.mutateAsync({ uid, name });
      }),
    );
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
    toast.success(`Successfully created ${data.length} enrollment(s).`);
    void usersQuery.refetch();
  };

  const deleteEnrollments = async (
    data: { uid: string; enrollment: Enrollment }[],
  ) => {
    const promises = data.map(({ uid, enrollment }) =>
      deleteEnrollmentMutation.mutateAsync({ uid, enrollment }),
    );
    const results = await Promise.allSettled(promises);
    const failure = results.find((result) => result.status === "rejected");
    if (failure) throw failure.reason;
    toast.success(`Successfully deleted ${data.length} enrollment(s).`);
    void usersQuery.refetch();
  };

  const [isAddEnrollmentsOpen, setAddEnrollmentsOpen] = useState(false);
  const [isImportEnrollmentsOpen, setImportEnrollmentsOpen] = useState(false);
  const [isDeleting, setDeleting] = useState(false);

  const handleCreate = async (
    data: AddEnrollmentSubmissionSchema | ImportEnrollmentSubmissionSchema,
  ) => {
    const mutationData = data.roaster.map((row) => {
      const enrollment = {
        course: cid,
        section: data.section,
        role: data.role,
      } satisfies Enrollment;
      return { uid: row.email, name: row.name, enrollment };
    });
    try {
      await createEnrollments(mutationData);
      setAddEnrollmentsOpen(false);
      setImportEnrollmentsOpen(false);
    } catch {
      // The mutation cache reports errors; keep the dialog and its values.
      void usersQuery.refetch();
    }
  };
  const handleDelete = async () => {
    if (isDeleting) return;
    setDeleting(true);
    const es = selection.map((s) => ({
      uid: s.user.email,
      enrollment: s.enrollment,
    }));
    try {
      await deleteEnrollments(es);
    } catch {
      // The mutation cache reports errors, including partial failures.
      void usersQuery.refetch();
    } finally {
      setSelection([]);
      tableRef.current?.clearSelection();
      setDeleting(false);
    }
  };
  const rosterUnavailable = usersQuery.isPending || usersQuery.isError;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-end gap-4">
        <Button
          variant="destructive"
          onClick={() => void handleDelete()}
          disabled={rosterUnavailable || selection.length === 0 || isDeleting}
        >
          {isDeleting
            ? "Deleting..."
            : `Delete ${selection.length} Enrollment(s)`}
        </Button>
        <Button
          onClick={() => setImportEnrollmentsOpen(true)}
          disabled={rosterUnavailable || isDeleting}
        >
          Import Enrollment(s)
        </Button>
        <Button
          onClick={() => setAddEnrollmentsOpen(true)}
          disabled={rosterUnavailable || isDeleting}
        >
          Add Enrollment(s)
        </Button>
      </div>

      {usersQuery.isError ? (
        <QueryError
          message="Could not load enrollments."
          onRetry={() => void usersQuery.refetch()}
          isRetrying={usersQuery.isFetching}
        />
      ) : usersQuery.isPending ? (
        <Spinner variant="ellipsis" />
      ) : (
        <EnrollmentTable
          enrollments={enrollments}
          updateSelection={setSelection}
          ref={tableRef}
        />
      )}

      <FieldDescription>
        You can import enrollments in bulk. You can delete enrollments by
        filtering and selecting them in the table. Users who haven't yet signed
        in to CRS for the first time will have their name blank.
      </FieldDescription>

      <Dialog open={isAddEnrollmentsOpen} onOpenChange={setAddEnrollmentsOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain"
        >
          <DialogHeader>
            <DialogTitle>Add Enrollments</DialogTitle>
          </DialogHeader>
          <AddEnrollmentForm
            onSubmit={handleCreate}
            disabled={rosterUnavailable || isDeleting}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={isImportEnrollmentsOpen}
        onOpenChange={setImportEnrollmentsOpen}
      >
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain"
        >
          <DialogHeader>
            <DialogTitle>Import Enrollments</DialogTitle>
          </DialogHeader>
          <ImportEnrollmentForm
            onSubmit={handleCreate}
            disabled={rosterUnavailable || isDeleting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

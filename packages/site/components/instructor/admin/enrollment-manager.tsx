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
import posthog from "posthog-js";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldDescription } from "@/components/ui/field";
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

  const { data: users, refetch } = useQuery(
    trpc.user.getAllFromCourse.queryOptions(cid),
  );
  const enrollments = (users ?? [])
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
    await Promise.all(
      data.map(async ({ uid, name, enrollment }) => {
        await createEnrollmentMutation.mutateAsync({ uid, enrollment });
        await suggestUserNameMutation.mutateAsync({ uid, name });
      }),
    );
    posthog.capture("enrollment_added", {
      course_id: Courses.id2str(cid),
      enrollment_count: data.length,
      role: data[0]?.enrollment.role,
      section: data[0]?.enrollment.section,
    });
    toast.success(`Successfully created ${data.length} enrollment(s).`);
    refetch();
  };

  const deleteEnrollments = async (
    data: { uid: string; enrollment: Enrollment }[],
  ) => {
    const promises = data.map(({ uid, enrollment }) =>
      deleteEnrollmentMutation.mutateAsync({ uid, enrollment }),
    );
    await Promise.all(promises);
    toast.success(`Successfully deleted ${data.length} enrollment(s).`);
    refetch();
  };

  const [isAddEnrollmentsOpen, setAddEnrollmentsOpen] = useState(false);
  const [isImportEnrollmentsOpen, setImportEnrollmentsOpen] = useState(false);

  const handleCreate = (
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
    createEnrollments(mutationData).then(() => {
      setAddEnrollmentsOpen(false);
      setImportEnrollmentsOpen(false);
    });
  };
  const handleDelete = () => {
    const es = selection.map((s) => ({
      uid: s.user.email,
      enrollment: s.enrollment,
    }));
    deleteEnrollments(es).then(() => {
      setSelection([]);
      tableRef.current?.clearSelection();
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-4">
        <Button
          variant="destructive"
          onClick={() => handleDelete()}
          disabled={
            selection.length === 0 || deleteEnrollmentMutation.isPending
          }
        >
          {deleteEnrollmentMutation.isPending
            ? "Deleting..."
            : `Delete ${selection.length} Enrollment(s)`}
        </Button>
        <Button onClick={() => setImportEnrollmentsOpen(true)}>
          Import Enrollment(s)
        </Button>
        <Button onClick={() => setAddEnrollmentsOpen(true)}>
          Add Enrollment(s)
        </Button>
      </div>

      <EnrollmentTable
        enrollments={enrollments}
        updateSelection={setSelection}
        ref={tableRef}
      />

      <FieldDescription>
        You can import enrollments in bulk. You can delete enrollments by
        filtering and selecting them in the table. Users who haven't yet signed
        in to CRS for the first time will have their name blank.
      </FieldDescription>

      <Dialog open={isAddEnrollmentsOpen} onOpenChange={setAddEnrollmentsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Enrollments</DialogTitle>
          </DialogHeader>
          <AddEnrollmentForm onSubmit={handleCreate} />
        </DialogContent>
      </Dialog>

      <Dialog
        open={isImportEnrollmentsOpen}
        onOpenChange={setImportEnrollmentsOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import Enrollments</DialogTitle>
          </DialogHeader>
          <ImportEnrollmentForm onSubmit={handleCreate} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

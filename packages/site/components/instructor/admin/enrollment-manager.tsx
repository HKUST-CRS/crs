"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  type CourseId,
  Courses,
  Enrollment,
  Enrollments,
  UserId,
} from "service/models";
import { compareString } from "service/utils/comparison";
import { toast } from "sonner";
import z, { ZodError } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FieldDescription,
  FieldError,
  FieldTitle,
} from "@/components/ui/field";
import { Kbd } from "@/components/ui/kbd";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/lib/trpc-client";
import { EnrollmentTable } from "./enrollment-table";

function parseRow(
  row: string,
  course: CourseId,
  ref: { section?: string; role?: string },
) {
  const [email, section = ref.section, role = ref.role] = row.split("\t");
  return {
    uid: UserId.parse(email),
    enrollment: Enrollment.parse({
      course,
      section,
      role: role,
    }),
  };
}

function generatePreviewMessage(input: string, cid: CourseId) {
  const rows = input
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  const ref = (() => {
    const [row] = rows;
    if (!row) return {};
    const [, section, role] = row.split("\t");
    return { section, role };
  })();
  const errors = rows
    .flatMap((row, idx) => {
      try {
        parseRow(row, cid, ref);
        return [];
      } catch (e) {
        if (e instanceof ZodError) {
          return [`[Row ${idx}] Error\n${z.prettifyError(e)}`];
        }
        throw e;
      }
    })
    .slice(0, 8);
  const successes = rows.flatMap((row, idx) => {
    try {
      const params = parseRow(row, cid, ref);
      return [
        // biome-ignore lint/suspicious/noArrayIndexKey: no other unique key available
        <span key={idx} className="block">
          [Row {idx}] Importing user <strong>{params.uid}</strong>: section{" "}
          <strong>{params.enrollment.section}</strong> in course{" "}
          <strong>{Courses.formatID(params.enrollment.course)}</strong> as{" "}
          <strong>{params.enrollment.role}</strong>
        </span>,
      ];
    } catch (e) {
      if (e instanceof ZodError) {
        return [];
      }
      throw e;
    }
  });
  if (errors.length > 0) {
    return {
      status: "error",
      msg: errors.join("\n"),
    } as const;
  }
  return {
    status: "ok",
    msg: successes,
  } as const;
}

function generateEnrollments(input: string, cid: CourseId) {
  const rows = input
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r.length > 0);
  const ref = (() => {
    const [row] = rows;
    if (!row) return {};
    const [, section, role] = row.split("\t");
    return { section, role };
  })();
  return rows.map((r) => parseRow(r, cid, ref));
}

export function EnrollmentManager({ cid }: { cid: CourseId }) {
  const trpc = useTRPC();

  const { data: user } = useQuery(trpc.user.get.queryOptions());

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

  const createEnrollment = useMutation(
    trpc.user.createEnrollment.mutationOptions({
      onSuccess: () => {
        toast.success("Successfully created the enrollment.");
        refetch();
      },
    }),
  );

  const deleteEnrollment = useMutation(
    trpc.user.deleteEnrollment.mutationOptions({
      onSuccess: () => {
        toast.success("Successfully deleted the enrollment.");
        refetch();
      },
    }),
  );

  const [isImporting, setImporting] = useState(false);
  const [importInput, setImportInput] = useState("");

  const importPreviewMsg = useMemo(
    () => generatePreviewMessage(importInput, cid),
    [cid, importInput],
  );

  const handleImport = () => {
    const es = generateEnrollments(importInput, cid);
    const ps = es.map((e) => createEnrollment.mutateAsync(e));
    Promise.all(ps).then(() => {
      setImportInput("");
    });
  };

  const [selection, setSelection] = useState<typeof enrollments>([]);

  const handleDelete = () => {
    const es = selection.map((s) => ({
      uid: s.user.email,
      enrollment: s.enrollment,
    }));
    if (
      es.some(
        (e) =>
          e.uid === user?.email &&
          (e.enrollment.role === "instructor" || e.enrollment.role === "admin"),
      )
    ) {
      toast.error("You cannot delete your own instructor or admin enrollment.");
      return;
    }
    es.map((e) => deleteEnrollment.mutate(e));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-4">
        <Button
          variant="destructive"
          onClick={() => handleDelete()}
          disabled={selection.length === 0 || deleteEnrollment.isPending}
        >
          {deleteEnrollment.isPending
            ? "Deleting..."
            : `Delete ${selection.length} Enrollment(s)`}
        </Button>
        <Button onClick={() => setImporting(!isImporting)}>
          {isImporting ? "Cancel Import Enrollment(s)" : "Import Enrollment(s)"}
        </Button>
      </div>

      {isImporting && (
        <Card>
          <CardContent className="space-y-4">
            <FieldTitle>Import Enrollment(s)</FieldTitle>
            <Textarea
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder={
                "example1@connect.ust.hk\tL1\tstudent\n" +
                "example2@connect.ust.hk\n" +
                "example3@connect.ust.hk\n"
              }
              rows={10}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className="font-mono"
              onKeyDown={(e) => {
                // Handle Tab key to insert tab character.
                if (e.key === "Tab") {
                  e.preventDefault();

                  const target = e.currentTarget;

                  const from = target.selectionStart;
                  const to = target.selectionEnd;

                  target.value =
                    target.value.substring(0, from) +
                    "\t" +
                    target.value.substring(to);

                  target.selectionStart = target.selectionEnd = from + 1;
                }
              }}
            />
            <FieldDescription>
              Paste the enrollment data from the Excel file here. The format of
              each line is
              <span className="mx-4 my-2 block">
                email <Kbd>Tab</Kbd> section <Kbd>Tab</Kbd> role
              </span>
              Note that role is one of <code>student</code>,{" "}
              <code>instructor</code>, <code>observer</code>, and{" "}
              <code>admin</code>. A <code>student</code> can create requests. An{" "}
              <code>instructor</code> can view the requests, manage the course
              (such as setting up sections and assignments), and approve/reject
              the requests. An <code>observer</code> can only view the requests.
              An <code>admin</code> can only manage the course. If the first
              line contains section and role, the sections and roles in the
              subsequent lines can be left blank, in which case they will
              inherit from the first line.
            </FieldDescription>
            <FieldDescription className="whitespace-pre-wrap font-mono">
              {importPreviewMsg.status === "ok" ? importPreviewMsg.msg : ""}
            </FieldDescription>
            <FieldError className="whitespace-pre-wrap font-mono">
              {importPreviewMsg.status === "error" ? importPreviewMsg.msg : ""}
            </FieldError>
            <Button
              onClick={handleImport}
              disabled={createEnrollment.isPending}
            >
              {createEnrollment.isPending ? "Importing..." : "Import"}
            </Button>
          </CardContent>
        </Card>
      )}

      <EnrollmentTable
        enrollments={enrollments}
        updateSelection={setSelection}
      />

      <FieldDescription>
        You can import enrollments in bulk. You can delete enrollments by
        filtering and selecting them in the table. Users who haven't yet logged
        in to CRS for the first time will have their name blank.
      </FieldDescription>
    </div>
  );
}

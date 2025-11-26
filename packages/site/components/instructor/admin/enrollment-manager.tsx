"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { type CourseId, Courses, Enrollment, UserId } from "service/models";
import { toast } from "sonner";
import z, { ZodError } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  FieldDescription,
  FieldError,
  FieldTitle,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/lib/trpc-client";
import { EnrollmentTable } from "./enrollment-table";

function parseRow(row: string, course: CourseId) {
  const [email, section, role] = row.split(",").map((s) => s.trim());
  return {
    uid: UserId.parse(email),
    enrollment: Enrollment.parse({
      course,
      section,
      role: role,
    }),
  };
}

export function EnrollmentManager({ cid }: { cid: CourseId }) {
  const trpc = useTRPC();

  const { data: user } = useQuery(trpc.user.get.queryOptions());

  const { data: users, refetch } = useQuery(
    trpc.user.getAllFromCourse.queryOptions(cid),
  );
  const enrollments = (users ?? []).flatMap((u) =>
    u.enrollment
      .filter((e) => Courses.id2str(e.course) === Courses.id2str(cid))
      .map((e) => ({ user: u, enrollment: e })),
  );

  const createEnrollment = useMutation(
    trpc.user.createEnrollment.mutationOptions({
      onSuccess: () => {
        toast.success("Successfully created the enrollment(s).");
        refetch();
      },
    }),
  );

  const deleteEnrollment = useMutation(
    trpc.user.deleteEnrollment.mutationOptions({
      onSuccess: () => {
        toast.success("Successfully deleted the enrollment(s).");
        refetch();
      },
    }),
  );

  const [isImporting, setImporting] = useState(false);
  const [importInput, setImportInput] = useState("");

  const importPreviewMsg = useMemo(() => {
    const rows = importInput
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    const errors = rows.flatMap((row, idx) => {
      try {
        parseRow(row, cid);
        return [];
      } catch (e) {
        if (e instanceof ZodError) {
          return [`[Row ${idx}] Error\n${z.prettifyError(e)}`];
        }
        throw e;
      }
    });
    const successes = rows.flatMap((row, idx) => {
      try {
        const params = parseRow(row, cid);
        return [
          `[Row ${idx}] Importing user ${params.uid}: section ${params.enrollment.section} in course ${Courses.formatID(params.enrollment.course)} as ${params.enrollment.role}`,
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
      };
    }
    return {
      status: "ok",
      msg: successes.join("\n"),
    };
  }, [cid, importInput]);

  const handleImport = () => {
    const es = importInput
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.length > 0)
      .map((r) => parseRow(r, cid));
    es.map((e) => createEnrollment.mutate(e));
  };

  const [selection, setSelection] = useState<typeof enrollments>([]);

  const handleDelete = () => {
    const es = selection.map((s) => ({
      uid: s.user.email,
      enrollment: s.enrollment,
    }));
    if (
      es.some(
        (e) => e.uid === user?.email && e.enrollment.role === "instructor",
      )
    ) {
      toast.error("You cannot delete your own instructor role.");
      return;
    }
    es.map((e) => deleteEnrollment.mutate(e));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end gap-4">
        <Button variant="destructive" onClick={() => handleDelete()}>
          Delete {selection.length} Enrollment(s)
        </Button>
        <Button onClick={() => setImporting(!isImporting)}>
          {isImporting ? "Cancel Import CSV" : "Import CSV"}
        </Button>
      </div>

      {isImporting && (
        <Card>
          <CardContent className="space-y-4">
            <FieldTitle>Import CSV Data</FieldTitle>
            <Textarea
              value={importInput}
              onChange={(e) => setImportInput(e.target.value)}
              placeholder="student@example.com, John Doe, L1, student"
              rows={10}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              className="font-mono"
            />
            <FieldDescription>
              Paste CSV data here. Format: <code>email,section,role</code>. Note
              that <code>role</code> is <code>student|instructor|ta</code>.
            </FieldDescription>
            <FieldDescription className="whitespace-pre-wrap">
              {importPreviewMsg.status === "ok" ? importPreviewMsg.msg : ""}
            </FieldDescription>
            <FieldError className="whitespace-pre-wrap">
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
        You can import enrollments in bulk using CSV format. You can delete
        enrollments by filtering and selecting them in the table. Newly imported
        users, if they haven't logged in to CRS before, will have blank names
        until they do so.
      </FieldDescription>
    </div>
  );
}

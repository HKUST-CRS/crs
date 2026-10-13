"use client";

import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import { type Course, Courses } from "service/models";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { FieldDescription } from "@/components/ui/field";
import { useTRPC } from "@/lib/trpc-client";
import { ExamForm, type ExamFormSchema } from "./exam-form";
import { type ExamRow, ExamTable } from "./exam-table";

export function ExamsConfig({
  course,
  onUpdate,
}: {
  course: Course;
  onUpdate: (s: Course["exams"]) => Promise<void>;
}) {
  const trpc = useTRPC();
  const rosterQuery = useQuery(
    trpc.user.getAllFromCourse.queryOptions({
      code: course.code,
      term: course.term,
    }),
  );
  const graders = (rosterQuery.data ?? [])
    .filter((user) =>
      user.enrollment.some(
        (enrollment) =>
          Courses.id2str(enrollment.course) === Courses.id2str(course) &&
          enrollment.role === "grader",
      ),
    )
    .sort((a, b) => a.email.localeCompare(b.email));
  const [isFormOpen, setFormOpen] = useState(false);
  const [focusExam, setFocusExam] = useState<ExamRow | null>(null);

  const exams = Object.entries(course.exams || {})
    .map(([code, data]) => ({
      code,
      ...data,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const handleSave = async (newExam: ExamFormSchema) => {
    const { [focusExam?.code ?? ""]: _, ...examsList } = course.exams ?? {};
    if (newExam.code in examsList) {
      toast.error("Exam code already exists");
      return;
    }
    const { code, ...rest } = newExam;
    const newExams = {
      ...examsList,
      [code]: rest,
    };
    try {
      await onUpdate(newExams);
      setFormOpen(false);
      setFocusExam(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save exams.",
      );
    }
  };

  const handleRemove = async () => {
    const { [focusExam?.code ?? ""]: _, ...newExams } = course.exams ?? {};

    try {
      await onUpdate(newExams);
      setFormOpen(false);
      setFocusExam(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not remove the exam.",
      );
    }
  };

  const handleNew = () => {
    setFocusExam(null);
    setFormOpen(true);
  };

  const handleEdit = (row: ExamRow) => {
    setFocusExam(row);
    setFormOpen(true);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <CardTitle>Exams (for request type Exam Appeal)</CardTitle>
        <Button onClick={handleNew} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add Exam
        </Button>
      </div>

      <ExamTable exams={exams} onClickRow={handleEdit} />

      <FieldDescription>
        This configures the exams in the course. This affects the request type{" "}
        <b>Exam Appeal</b>. Add exams here (e.g., Midterm, Final) and specify
        their questions to allow students to submit appeals for them. Enroll
        graders through the Enrollments section first, then assign each question
        to a grader. Use section * for a grader covering the whole course.
      </FieldDescription>
      {rosterQuery.error && (
        <p role="alert" className="text-destructive text-sm">
          Could not load graders: {rosterQuery.error.message}
        </p>
      )}

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent
          aria-describedby={undefined}
          className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain"
        >
          <DialogHeader>
            <DialogTitle>{focusExam ? "Edit Exam" : "Add Exam"}</DialogTitle>
          </DialogHeader>
          <ExamForm
            graders={graders}
            defaultValues={focusExam ?? undefined}
            onSubmit={handleSave}
            onRemove={handleRemove}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import type { Course } from "service/models";
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
import {
  ExaminationForm,
  type ExaminationFormSchema,
} from "./examination-form";
import { type ExaminationRow, ExaminationTable } from "./examination-table";

export function ExaminationsConfig({
  course,
  onUpdate,
}: {
  course: Course;
  onUpdate: (s: Course["examinations"]) => Promise<void>;
}) {
  const [isFormOpen, setFormOpen] = useState(false);
  const [focusExamination, setFocusExamination] =
    useState<ExaminationRow | null>(null);

  const examinations = Object.entries(course.examinations || {})
    .map(([code, data]) => ({
      code,
      ...data,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const handleSave = async (newExamination: ExaminationFormSchema) => {
    const examination = focusExamination;
    const { [examination?.code ?? ""]: _, ...examinationsList } =
      course.examinations ?? {};
    if (newExamination.code in examinationsList) {
      toast.error("Examination code already exists");
      return;
    }
    const { code, ...rest } = newExamination;
    const newExaminations = {
      ...examinationsList,
      [code]: rest,
    };
    try {
      await onUpdate(newExaminations);
      setFormOpen(false);
      setFocusExamination(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save examinations.",
      );
    }
  };

  const handleRemove = async () => {
    const examination = focusExamination;
    const { [examination?.code ?? ""]: _, ...newExaminations } =
      course.examinations ?? {};

    try {
      await onUpdate(newExaminations);
      setFormOpen(false);
      setFocusExamination(null);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Could not remove the examination.",
      );
    }
  };

  const handleNew = () => {
    setFocusExamination(null);
    setFormOpen(true);
  };

  const handleEdit = (row: ExaminationRow) => {
    setFocusExamination(row);
    setFormOpen(true);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <CardTitle>
          Examinations (for request type Examination Appeal)
        </CardTitle>
        <Button onClick={handleNew} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add Examination
        </Button>
      </div>

      <ExaminationTable examinations={examinations} onClickRow={handleEdit} />

      <FieldDescription>
        This configures the examinations in the course. This affects the request
        type <b>Examination Appeal</b>. Add exams here (e.g., Midterm, Final)
        and specify their questions to allow students to submit appeals for
        them.
      </FieldDescription>

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain">
          <DialogHeader>
            <DialogTitle>
              {focusExamination ? "Edit Examination" : "Add Examination"}
            </DialogTitle>
          </DialogHeader>
          <ExaminationForm
            defaultValues={focusExamination ?? undefined}
            onSubmit={handleSave}
            onRemove={handleRemove}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

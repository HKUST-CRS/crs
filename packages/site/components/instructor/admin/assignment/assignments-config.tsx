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
import { AssignmentForm, type AssignmentFormSchema } from "./assignment-form";
import { type AssignmentRow, AssignmentTable } from "./assignment-table";

export function AssignmentsConfig({
  course,
  onUpdate,
}: {
  course: Course;
  onUpdate: (s: Course["assignments"]) => void;
}) {
  const [isFormOpen, setFormOpen] = useState(false);
  const [focusAssignment, setFocusAssignment] = useState<AssignmentRow | null>(
    null,
  );

  const assignments = Object.entries(course.assignments)
    .map(([code, data]) => ({
      code,
      ...data,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const handleSave = (newAssignment: AssignmentFormSchema) => {
    const assignment = focusAssignment;

    const { [assignment?.code ?? ""]: _, ...assignments } = course.assignments;
    if (newAssignment.code in assignments) {
      toast.error("Assignment code already exists");
      return;
    }

    const { code, ...rest } = newAssignment;
    const newAssignments = {
      ...assignments,
      [code]: rest,
    };

    onUpdate(newAssignments);

    setFormOpen(false);
    setFocusAssignment(null);
  };

  const handleRemove = () => {
    const assignment = focusAssignment;
    const { [assignment?.code ?? ""]: _, ...newAssignments } =
      course.assignments;

    onUpdate(newAssignments);
    setFormOpen(false);
    setFocusAssignment(null);
  };

  const handleNew = () => {
    setFocusAssignment(null);
    setFormOpen(true);
  };

  const handleEdit = (row: AssignmentRow) => {
    setFocusAssignment(row);
    setFormOpen(true);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-row items-end justify-between">
        <CardTitle>Assignments (for request type Deadline Extension)</CardTitle>
        <Button onClick={handleNew} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add Assignment
        </Button>
      </div>
      <AssignmentTable assignments={assignments} onClickRow={handleEdit} />

      <FieldDescription>
        This configures the assignments in the course. This only affects the
        request type <b>Deadline Extension</b>. Therefore, only assignments that
        can have deadline extensions should be added here.
      </FieldDescription>

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {focusAssignment ? "Edit Assignment" : "Add Assignment"}
            </DialogTitle>
          </DialogHeader>
          <AssignmentForm
            defaultValues={focusAssignment ?? undefined}
            onSubmit={handleSave}
            onRemove={handleRemove}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

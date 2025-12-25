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
import { SectionForm, type SectionFormSchema } from "./section-form";
import { type SectionRow, SectionTable } from "./section-table";

export function SectionsConfig({
  course,
  onUpdate,
}: {
  course: Course;
  onUpdate: (s: Course["sections"]) => void;
}) {
  const [isFormOpen, setFormOpen] = useState(false);
  const [focusSection, setFocusSection] = useState<SectionRow | null>(null);

  const sections = Object.entries(course.sections)
    .map(([code, data]) => ({
      code,
      ...data,
    }))
    .sort((a, b) => a.code.localeCompare(b.code));

  const handleSave = (newSection: SectionFormSchema) => {
    const section = focusSection;

    const { [section?.code ?? ""]: _, ...sections } = course.sections;
    if (newSection.code in sections) {
      toast.error("Section code already exists");
      return;
    }

    const { code, ...rest } = newSection;
    const newSections = {
      ...sections,
      [code]: rest,
    };

    onUpdate(newSections);

    setFormOpen(false);
    setFocusSection(null);
  };

  const handleRemove = () => {
    const section = focusSection;
    const { [section?.code ?? ""]: _, ...newSections } = course.sections;

    onUpdate(newSections);
    setFormOpen(false);
    setFocusSection(null);
  };

  const handleNew = () => {
    setFocusSection(null);
    setFormOpen(true);
  };

  const handleEdit = (row: SectionRow) => {
    setFocusSection(row);
    setFormOpen(true);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-row items-end justify-between">
        <CardTitle>Sections</CardTitle>
        <Button onClick={handleNew} size="sm">
          <Plus className="mr-2 h-4 w-4" /> Add Section
        </Button>
      </div>
      <SectionTable sections={sections} onClickRow={handleEdit} />

      <FieldDescription>
        This configures the sections in the course. This only affects how
        students can create the requests, e.g., swap from one section to
        another, which are typically lab sections. In other words, it does not
        have to be configured to add new enrollments to the course / section.
      </FieldDescription>

      <Dialog open={isFormOpen} onOpenChange={setFormOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {focusSection ? "Edit Section" : "Add Section"}
            </DialogTitle>
          </DialogHeader>
          <SectionForm
            defaultValues={focusSection ?? undefined}
            onSubmit={handleSave}
            onRemove={handleRemove}
          />
        </DialogContent>
      </Dialog>
    </section>
  );
}

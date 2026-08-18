"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { range } from "es-toolkit";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { type Course, Terms } from "service/models";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ImportedCourse } from "@/lib/ust-archive";

const CourseFormSchema = z.object({
  code: z.string().regex(/^[A-Z]+ \d+[A-Z]*$/, "Invalid code."),
  term: z.string().regex(/^\d\d[1234]0$/, "Invalid term."),
  title: z.string().min(1, "Required title."),
});

type CourseFormValues = z.infer<typeof CourseFormSchema>;

export type CourseCreationSubmission =
  | { kind: "manual"; course: Course }
  | {
      kind: "automatic";
      course: Course;
      instructors: Array<
        ImportedCourse["instructors"][number] & { email: string }
      >;
    };

const requestTypes = {
  "Swap Section": true,
  "Absent from Section": true,
  "Deadline Extension": true,
};

const weekdays = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatSlot(slot: { day: number; from: string; to: string }) {
  return `${weekdays[slot.day]} ${slot.from}–${slot.to}`;
}

export function CreateCourseForm({
  onSubmit,
}: {
  onSubmit: (submission: CourseCreationSubmission) => void | Promise<void>;
}) {
  const [imported, setImported] = useState<ImportedCourse | null>(null);
  const [emails, setEmails] = useState<string[]>([]);
  const form = useForm<CourseFormValues>({
    resolver: zodResolver(CourseFormSchema),
    defaultValues: { code: "", term: "", title: "" },
  });
  const importCourse = useMutation({
    mutationFn: async ({
      term,
      code,
    }: Pick<CourseFormValues, "term" | "code">) => {
      const { loadCourse } = await import("@/lib/ust-archive");
      return loadCourse(term, code);
    },
    onSuccess: (result) => {
      setImported(result);
      setEmails(result.instructors.map(() => ""));
      form.setValue("title", result.course.title, { shouldValidate: true });
    },
  });

  const clearImport = () => {
    setImported(null);
    setEmails([]);
    importCourse.reset();
  };

  const handleImport = async () => {
    const code = form.getValues("code").trim().toUpperCase();
    form.setValue("code", code);
    if (!(await form.trigger(["term", "code"]))) return;
    importCourse.mutate({ term: form.getValues("term"), code });
  };

  const handleSubmit = async (data: CourseFormValues) => {
    const course: Course = {
      ...data,
      sections: imported?.course.sections ?? {},
      assignments: {},
      effectiveRequestTypes: requestTypes,
    };
    await onSubmit(
      imported
        ? {
            kind: "automatic",
            course,
            instructors: imported.instructors.map((instructor, index) => ({
              ...instructor,
              email: emails[index].trim(),
            })),
          }
        : { kind: "manual", course },
    );
  };

  const currentTerm = Terms.term2num(Terms.currentTermApprox());
  const terms = range(currentTerm - 4, currentTerm + 8).map(Terms.num2term);

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="grid grid-cols-2 gap-4"
    >
      <Controller
        name="code"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel htmlFor="course-code">Code</FieldLabel>
            <Input
              {...field}
              id="course-code"
              autoComplete="off"
              spellCheck={false}
              placeholder="COMP 1023…"
              aria-invalid={fieldState.invalid || undefined}
              disabled={importCourse.isPending}
              onChange={(event) => {
                field.onChange(event);
                clearImport();
              }}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="term"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel htmlFor="course-term">Term</FieldLabel>
            <Select
              value={field.value}
              disabled={importCourse.isPending}
              onValueChange={(value) => {
                field.onChange(value);
                clearImport();
              }}
            >
              <SelectTrigger id="course-term" className="w-full">
                <SelectValue placeholder="Choose a term" />
              </SelectTrigger>
              <SelectContent>
                {terms.map((term) => (
                  <SelectItem key={term} value={term}>
                    {Terms.formatTerm(term)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="title"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field className="col-span-full">
            <FieldLabel htmlFor="course-title">Title</FieldLabel>
            <Input
              {...field}
              id="course-title"
              autoComplete="off"
              placeholder="Introduction to Computer Science…"
              aria-invalid={fieldState.invalid || undefined}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      {importCourse.error ? (
        <FieldError
          className="col-span-full"
          errors={[
            {
              message:
                importCourse.error instanceof Error
                  ? importCourse.error.message
                  : "Course import failed.",
            },
          ]}
        />
      ) : null}

      {imported ? (
        <div className="col-span-full flex flex-col gap-4 text-sm">
          <section>
            <h3 className="font-medium">Imported Sections</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {Object.entries(imported.course.sections).map(
                ([section, data]) => (
                  <li key={section} className="rounded-md border p-3">
                    <span className="font-medium" translate="no">
                      {section}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {data.schedule.length
                        ? data.schedule.map(formatSlot).join(", ")
                        : "No scheduled meeting"}
                    </span>
                  </li>
                ),
              )}
            </ul>
          </section>

          {imported.instructors.length ? (
            <section className="flex flex-col gap-3">
              <h3 className="font-medium">Instructor Emails</h3>
              {imported.instructors.map((instructor, index) => (
                <Field key={instructor.name}>
                  <FieldLabel htmlFor={`instructor-email-${index}`}>
                    {instructor.name}
                    <span className="font-normal text-muted-foreground">
                      Sections: {instructor.sections.join(", ")}
                    </span>
                  </FieldLabel>
                  <Input
                    id={`instructor-email-${index}`}
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="name@example.com…"
                    value={emails[index]}
                    onChange={(event) =>
                      setEmails((current) =>
                        current.with(index, event.target.value),
                      )
                    }
                  />
                </Field>
              ))}
            </section>
          ) : null}
        </div>
      ) : null}

      <DialogFooter className="col-span-full flex-row justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={handleImport}
          disabled={importCourse.isPending || form.formState.isSubmitting}
        >
          {importCourse.isPending ? "Importing…" : "Import Schedule"}
        </Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Creating…" : "Create"}
        </Button>
      </DialogFooter>
    </form>
  );
}

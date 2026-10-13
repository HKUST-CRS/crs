"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import type { Exam, User } from "service/models";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const ExamFormSchema = z.strictObject({
  code: z.string().trim().min(1, "Code is required (e.g. Midterm)"),
  questions: z
    .array(
      z.strictObject({
        question: z
          .string()
          .trim()
          .min(1, "A question identifier is required."),
        grader: z.email(),
      }),
    )
    .refine(
      (questions) =>
        new Set(questions.map(({ question }) => question)).size ===
        questions.length,
      "Question identifiers must be unique within an exam.",
    ),
});

export type ExamFormSchema = z.infer<typeof ExamFormSchema>;

export function ExamForm({
  graders,
  defaultValues,
  onSubmit,
  onRemove,
}: {
  graders: Pick<User, "email" | "name">[];
  defaultValues?: Exam & { code: string };
  onSubmit: (v: ExamFormSchema) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);
  const form = useForm<ExamFormSchema>({
    resolver: zodResolver(ExamFormSchema),
    defaultValues: defaultValues
      ? {
          code: defaultValues.code,
          questions: Object.entries(defaultValues.questions).map(
            ([question, { grader }]) => ({ question, grader }),
          ),
        }
      : {
          code: "",
          questions: [],
        },
  });

  const questionsList = useFieldArray({
    control: form.control,
    name: "questions",
  });

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="flex min-w-0 flex-col gap-4"
    >
      <fieldset
        disabled={form.formState.isSubmitting || removing}
        className="flex min-w-0 flex-col gap-4"
      >
        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="exam-code">Exam Code</FieldLabel>
              <Input
                id="exam-code"
                placeholder="Midterm / Final / Quiz 1"
                spellCheck={false}
                {...field}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>Questions & Grader Assignments</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => questionsList.append({ question: "", grader: "" })}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Question
            </Button>
          </div>

          {questionsList.fields.map((field, index) => {
            return (
              <div key={field.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Controller
                    name={`questions.${index}.question`}
                    control={form.control}
                    render={({ field }) => (
                      <Field className="min-w-0 flex-1">
                        <Input
                          aria-label={`Question ${index + 1} identifier`}
                          placeholder="e.g. Q1, Q2a"
                          spellCheck={false}
                          {...field}
                        />
                      </Field>
                    )}
                  />
                  -
                  <Controller
                    name={`questions.${index}.grader`}
                    control={form.control}
                    render={({ field }) => (
                      <Field className="min-w-0 flex-[2]">
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            className="w-full"
                            aria-label={`Question ${index + 1} grader`}
                          >
                            <SelectValue placeholder="Select grader" />
                          </SelectTrigger>
                          <SelectContent>
                            {field.value &&
                              !graders.some(
                                (grader) => grader.email === field.value,
                              ) && (
                                <SelectItem value={field.value} disabled>
                                  {field.value} (no longer enrolled as a grader)
                                </SelectItem>
                              )}
                            {graders.map((grader) => (
                              <SelectItem
                                key={grader.email}
                                value={grader.email}
                              >
                                {grader.name
                                  ? `${grader.name} (${grader.email})`
                                  : grader.email}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </Field>
                    )}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove question ${index + 1}`}
                    onClick={() => questionsList.remove(index)}
                  >
                    <Trash className="h-4 w-4" />
                  </Button>
                </div>
                <div className="flex flex-col">
                  <FieldError
                    errors={[
                      form.formState.errors.questions?.[index]?.question,
                    ]}
                  />
                  <FieldError
                    errors={[form.formState.errors.questions?.[index]?.grader]}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {!graders.length && (
          <p className="typo-muted text-sm">
            Enroll a grader in this course before assigning questions.
          </p>
        )}

        <FieldError
          errors={[
            form.formState.errors.questions?.root ??
              form.formState.errors.questions,
          ]}
        />

        <DialogFooter className="gap-2">
          {defaultValues && (
            <Button
              type="button"
              variant="destructive"
              onClick={async () => {
                if (
                  !window.confirm(
                    `Remove exam ${defaultValues.code} and its question assignments?`,
                  )
                )
                  return;
                setRemoving(true);
                try {
                  await onRemove();
                } finally {
                  setRemoving(false);
                }
              }}
            >
              {removing ? "Removing…" : "Remove"}
            </Button>
          )}
          <Button type="submit">
            {form.formState.isSubmitting ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </fieldset>
    </form>
  );
}

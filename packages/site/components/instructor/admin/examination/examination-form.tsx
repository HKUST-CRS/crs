"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash } from "lucide-react";
import { useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Examination } from "service/models";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const ExaminationFormSchema = z.object({
  code: z.string().trim().min(1, "Code is required (e.g. Midterm)"),
  ...Examination.shape,
});

export type ExaminationFormSchema = z.infer<typeof ExaminationFormSchema>;

export function ExaminationForm({
  defaultValues,
  onSubmit,
  onRemove,
}: {
  defaultValues?: ExaminationFormSchema;
  onSubmit: (v: ExaminationFormSchema) => Promise<void>;
  onRemove: () => Promise<void>;
}) {
  const [removing, setRemoving] = useState(false);
  const form = useForm<ExaminationFormSchema>({
    resolver: zodResolver(ExaminationFormSchema),
    defaultValues: defaultValues ?? {
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
      className="flex flex-col gap-4"
    >
      <fieldset
        disabled={form.formState.isSubmitting || removing}
        className="contents"
      >
        <Controller
          name="code"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor="examination-code">
                Examination Code
              </FieldLabel>
              <Input
                id="examination-code"
                placeholder="Midterm / Final / Quiz 1"
                spellCheck={false}
                {...field}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Questions & TA Assignments</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                questionsList.append({ questionNumber: "", taId: "" })
              }
            >
              <Plus className="mr-2 h-4 w-4" /> Add Question
            </Button>
          </div>

          {questionsList.fields.map((field, index) => {
            return (
              <div key={field.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Controller
                    name={`questions.${index}.questionNumber`}
                    control={form.control}
                    render={({ field }) => (
                      <Field className="min-w-0 flex-1">
                        <Input
                          aria-label={`Question ${index + 1} number`}
                          placeholder="e.g. Q1, Q2a"
                          spellCheck={false}
                          {...field}
                        />
                      </Field>
                    )}
                  />
                  -
                  <Controller
                    name={`questions.${index}.taId`}
                    control={form.control}
                    render={({ field }) => (
                      <Field className="min-w-0 flex-[2]">
                        <Input
                          aria-label={`Question ${index + 1} TA email`}
                          type="email"
                          autoComplete="email"
                          spellCheck={false}
                          placeholder="TA Email (e.g. ta@ust.hk)"
                          {...field}
                        />
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
                      form.formState.errors.questions?.[index]?.questionNumber,
                    ]}
                  />
                  <FieldError
                    errors={[form.formState.errors.questions?.[index]?.taId]}
                  />
                </div>
              </div>
            );
          })}
        </div>

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
                    `Remove examination ${defaultValues.code} and its question assignments?`,
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

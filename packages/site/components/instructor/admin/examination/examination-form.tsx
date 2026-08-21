"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const ExaminationFormSchema = z.object({
  code: z.string().min(1, "Code is required (e.g. Midterm)"),
  questions: z.array(
    z.object({
      questionNumber: z.string().min(1, "Question number is required"),
      taId: z.string().email("Must be a valid email address"),
    })
  ),
});

export type ExaminationFormSchema = z.infer<typeof ExaminationFormSchema>;

export function ExaminationForm({
  defaultValues,
  onSubmit,
  onRemove,
}: {
  defaultValues?: ExaminationFormSchema;
  onSubmit: (v: ExaminationFormSchema) => void;
  onRemove: () => void;
}) {
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
      <Controller
        name="code"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Examination Code</FieldLabel>
            <Input placeholder="Midterm / Final / Quiz 1" {...field} />
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
            onClick={() => questionsList.append({ questionNumber: "", taId: "" })}
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
                    <Field className="flex-1">
                      <Input placeholder="e.g. Q1, Q2a" {...field} />
                    </Field>
                  )}
                />
                -
                <Controller
                  name={`questions.${index}.taId`}
                  control={form.control}
                  render={({ field }) => (
                    <Field className="flex-[2]">
                      <Input placeholder="TA Email (e.g. ta@ust.hk)" {...field} />
                    </Field>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => questionsList.remove(index)}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-col">
                <FieldError
                  errors={[form.formState.errors.questions?.[index]?.questionNumber]}
                />
                <FieldError
                  errors={[form.formState.errors.questions?.[index]?.taId]}
                />
              </div>
            </div>
          );
        })}
      </div>

      <DialogFooter className="gap-2">
        {defaultValues && (
          <Button
            type="button"
            variant="destructive"
            onClick={() => onRemove()}
          >
            Remove
          </Button>
        )}
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  );
}
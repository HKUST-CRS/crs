"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { range } from "es-toolkit";
import { Controller, useForm } from "react-hook-form";
import { Terms } from "service/models";
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

export const CreateCourseFormSchema = z.object({
  code: z.string().regex(/^[A-Z]+ \d+$/, "Invalid code."),
  term: z.string().regex(/^\d\d[1234]0$/, "Invalid term."),
  title: z.string().min(1, "Required title."),
});

export type CreateCourseFormSchema = z.infer<typeof CreateCourseFormSchema>;

export function CreateCourseForm({
  onSubmit,
}: {
  onSubmit: (v: CreateCourseFormSchema) => void;
}) {
  const form = useForm<CreateCourseFormSchema>({
    resolver: zodResolver(CreateCourseFormSchema),
    defaultValues: {
      code: "",
      term: "",
      title: "",
    },
  });

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="grid grid-cols-2 gap-4"
    >
      <Controller
        name="code"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field className="col-span-1">
            <FieldLabel>Code</FieldLabel>
            <Input placeholder="COMP 1023" {...field} />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="term"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field className="col-span-1">
            <FieldLabel>Term</FieldLabel>
            <Select
              value={field.value}
              onValueChange={(v) => field.onChange(v)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Choose a term" />
              </SelectTrigger>
              <SelectContent>
                {(() => {
                  const currentTermNum = Terms.term2num(
                    Terms.currentTermApprox(),
                  );
                  return range(currentTermNum - 4, currentTermNum + 8).map(
                    (termNum) => {
                      const term = Terms.num2term(termNum);
                      return (
                        <SelectItem key={term} value={term}>
                          {Terms.formatTerm(term)}
                        </SelectItem>
                      );
                    },
                  );
                })()}
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
          <Field className="col-span-2">
            <FieldLabel>Title</FieldLabel>
            <Input placeholder="Introduction to Computer Science" {...field} />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <DialogFooter className="col-span-full gap-2">
        <Button type="submit">Create</Button>
      </DialogFooter>
    </form>
  );
}

"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { DateTime, Duration } from "luxon";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";

export const AssignmentFormSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  due: z.string().min(1, "Due date is required"),
  maxExtension: z.string().min(1, "Max extension is required"),
});

export type AssignmentFormSchema = z.infer<typeof AssignmentFormSchema>;

export function AssignmentForm({
  defaultValues,
  onSubmit,
  onRemove,
}: {
  defaultValues?: AssignmentFormSchema;
  onSubmit: (v: AssignmentFormSchema) => void;
  onRemove: () => void;
}) {
  const form = useForm<AssignmentFormSchema>({
    resolver: zodResolver(AssignmentFormSchema),
    defaultValues: defaultValues ?? {
      code: "",
      name: "",
      due: "",
      maxExtension: "P0D",
    },
  });

  const due = DateTime.fromISO(form.watch("due"));

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
            <FieldLabel>Code</FieldLabel>
            <Input placeholder="Lab1/PA1/Assignment1/..." {...field} />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="name"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Name</FieldLabel>
            <Input placeholder="Math Expression Evaluator" {...field} />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="due"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Due Date</FieldLabel>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarIcon />
                  {field.value ? (
                    DateTime.fromISO(field.value).toLocaleString()
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={DateTime.fromISO(field.value).toJSDate()}
                  onSelect={(date) => {
                    if (date) {
                      field.onChange(
                        DateTime.fromJSDate(date).endOf("day").toISO(),
                      );
                    }
                  }}
                  className="rounded-lg border shadow-sm"
                />
              </PopoverContent>
            </Popover>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="maxExtension"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Latest Due Date after Extension</FieldLabel>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  <CalendarIcon />
                  {field.value ? (
                    due.plus(Duration.fromISO(field.value)).toLocaleString()
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                {
                  <Calendar
                    mode="single"
                    selected={due
                      .plus(Duration.fromISO(field.value))
                      .toJSDate()}
                    onSelect={(date) => {
                      if (date) {
                        field.onChange(
                          DateTime.fromJSDate(date)
                            .endOf("day")
                            .diff(due)
                            .toISO(),
                        );
                      }
                    }}
                    className="rounded-lg border shadow-sm"
                  />
                }
              </PopoverContent>
            </Popover>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

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

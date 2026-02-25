"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import { DateTime, Duration } from "luxon";
import { Controller, useForm } from "react-hook-form";
import { DateFormatter, DateTimeFormatter, TimeFormatter } from "service/utils/datetime";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { DialogFooter } from "@/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
  const dueValid = due.isValid;

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
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="flex-1">
                    <CalendarIcon />
                    {field.value ? (
                      DateTime.fromISO(field.value).toFormat(DateFormatter)
                    ) : (
                      <span>Pick a date</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={DateTime.fromISO(field.value).toJSDate()}
                    defaultMonth={
                      field.value
                        ? DateTime.fromISO(field.value).toJSDate()
                        : DateTime.now().toJSDate()
                    }
                    onSelect={(date) => {
                      if (date) {
                        const currentValue = field.value
                          ? DateTime.fromISO(field.value)
                          : DateTime.now().endOf("day");

                        const updated = DateTime.fromJSDate(date).set({
                          year: date.getFullYear(),
                          month: date.getMonth() + 1,
                          day: date.getDate(),
                          hour: currentValue.hour,
                          minute: currentValue.minute,
                          second: currentValue.second,
                          millisecond: currentValue.millisecond,
                        });
                        field.onChange(updated.toISO());
                      }
                    }}
                    className="rounded-lg border shadow-sm"
                  />
                </PopoverContent>
              </Popover>
              <Input
                type="time"
                step={60 * 10}
                disabled={!field.value}
                value={DateTime.fromISO(field.value).toFormat(TimeFormatter)}
                onChange={(e) => {
                  if (field.value) {
                    const [hour, minute] = e.target.value
                      .split(":")
                      .map((str) => Number(str));
                    const updated = DateTime.fromISO(field.value).set({
                      hour: hour,
                      minute: minute,
                      second: 59,
                      millisecond: 999,
                    });
                    field.onChange(updated.toISO());
                  }
                }}
                className="w-min"
              />
            </div>
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
                <Button variant="outline" disabled={!dueValid}>
                  <CalendarIcon />
                  {field.value && dueValid ? (
                    due
                      .plus(Duration.fromISO(field.value))
                      .toFormat(DateTimeFormatter)
                  ) : (
                    <span>Pick a date</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                {dueValid && (
                  <Calendar
                    mode="single"
                    selected={due
                      .plus(Duration.fromISO(field.value))
                      .toJSDate()}
                    disabled={(date) =>
                      DateTime.fromJSDate(date).startOf("day") <
                      due.startOf("day")
                    }
                    defaultMonth={
                      field.value
                        ? due.plus(Duration.fromISO(field.value)).toJSDate()
                        : DateTime.now().toJSDate()
                    }
                    onSelect={(date) => {
                      if (date && dueValid) {
                        const extensionDateTime = DateTime.fromJSDate(date).set(
                          {
                            hour: due.hour,
                            minute: due.minute,
                            second: due.second,
                            millisecond: due.millisecond,
                          },
                        );
                        field.onChange(extensionDateTime.diff(due).toISO());
                      }
                    }}
                    className="rounded-lg border shadow-sm"
                  />
                )}
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

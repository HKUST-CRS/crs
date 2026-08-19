"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import { DateTime, Duration } from "luxon";
import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  formatDate,
  formatDateTime,
  formatMonth,
  fromISO,
  toISO,
  withTime,
} from "service/utils/datetime";
import { z } from "zod";
import { TimePicker } from "@/components/shadcn-studio/date-picker/date-picker-08";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { emailsToText, parseEmails } from "../emails";
import type { AssignmentRow } from "./assignment-table";
export const AssignmentFormSchema = z.object({
  code: z.string().min(1, "Code is required"),
  name: z.string().min(1, "Name is required"),
  due: z.string().min(1, "Due date is required"),
  maxExtension: z.string().min(1, "Max extension is required"),
  state: z.enum(["open", "closed", "graded"]).optional(),
  tas: z.string(),
});

export type AssignmentFormSchema = z.infer<typeof AssignmentFormSchema>;

export const AssignmentSubmissionSchema = AssignmentFormSchema.omit({
  tas: true,
}).extend({
  tas: z.array(z.string()).optional(),
});

export type AssignmentSubmissionSchema = z.infer<
  typeof AssignmentSubmissionSchema
>;

export function AssignmentForm({
  defaultValues,
  onSubmit,
  onRemove,
}: {
  defaultValues?: AssignmentRow;
  onSubmit: (v: AssignmentSubmissionSchema) => void;
  onRemove: () => void;
}) {
  const form = useForm<AssignmentFormSchema>({
    resolver: zodResolver(AssignmentFormSchema),
    defaultValues: defaultValues
      ? {
          ...defaultValues,
          tas: emailsToText(defaultValues.tas),
        }
      : {
          code: "",
          name: "",
          due: "",
          maxExtension: "P0D",
          state: "open",
          tas: "",
        },
  });

  const handleSubmit = (data: AssignmentFormSchema) => {
    const { tas, ...rest } = data;
    onSubmit({ ...rest, tas: parseEmails(tas) });
  };

  const initialDue = fromISO(defaultValues?.due ?? "");
  const [dueDate, setDueDate] = useState<DateTime | null>(
    initialDue.isValid ? initialDue.startOf("day") : null,
  );
  const [dueTime, setDueTime] = useState<DateTime | null>(
    initialDue.isValid ? initialDue : null,
  );

  const due = useMemo(
    () => (dueDate && dueTime ? withTime(dueDate, dueTime) : null),
    [dueDate, dueTime],
  );
  useEffect(() => {
    form.setValue("due", due?.isValid ? toISO(due) : "");
  }, [due, form]);
  const dueValid = due?.isValid === true;
  const maxExtension = Duration.fromISO(form.watch("maxExtension"));
  const maxDueCandidate =
    due?.isValid && maxExtension.isValid ? due.plus(maxExtension) : null;
  const maxDue = maxDueCandidate?.isValid ? maxDueCandidate : null;

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="flex flex-col gap-4"
    >
      <Controller
        name="code"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel htmlFor="assignment-code">Code</FieldLabel>
            <Input
              id="assignment-code"
              autoComplete="off"
              spellCheck={false}
              placeholder="Lab1/PA1/Assignment1…"
              {...field}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="name"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel htmlFor="assignment-name">Name</FieldLabel>
            <Input
              id="assignment-name"
              autoComplete="off"
              placeholder="Math Expression Evaluator…"
              {...field}
            />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="due"
        control={form.control}
        render={({ fieldState }) => (
          <Field>
            <FieldLabel htmlFor="assignment-due-date">Due Date</FieldLabel>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="assignment-due-date"
                    variant="outline"
                    className="flex-1"
                  >
                    <CalendarIcon />
                    {dueDate ? formatDate(dueDate) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dueDate
                      ?.setZone("local", { keepLocalTime: true })
                      .toJSDate()}
                    defaultMonth={
                      dueDate
                        ? dueDate
                            .setZone("local", { keepLocalTime: true })
                            .toJSDate()
                        : DateTime.now().toJSDate()
                    }
                    onSelect={(date) => {
                      if (date) {
                        const selectedDate = DateTime.fromJSDate(date)
                          .setZone("Asia/Hong_Kong", { keepLocalTime: true })
                          .setLocale("en-HK")
                          .startOf("day");
                        setDueDate(selectedDate);
                        setDueTime(
                          (current) => current ?? selectedDate.endOf("day"),
                        );
                      }
                    }}
                    captionLayout="dropdown"
                    startMonth={new Date(2020, 0)}
                    endMonth={new Date(2030, 11)}
                    className="rounded-lg border shadow-sm"
                    formatters={{
                      formatMonthDropdown: (date) => formatMonth(date),
                    }}
                  />
                </PopoverContent>
              </Popover>
              <TimePicker
                id="assignment-due-time"
                value={dueTime?.toFormat("HH:mm:ss") ?? ""}
                disabled={!dueDate}
                label="Due date"
                className="max-w-none flex-1"
                onChange={(value) => {
                  const selectedTime = fromISO(value);
                  setDueTime(selectedTime.isValid ? selectedTime : null);
                }}
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
            <FieldLabel htmlFor="assignment-max-extension">
              Latest Due Date after Extension
            </FieldLabel>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    id="assignment-max-extension"
                    variant="outline"
                    className="flex-1"
                    disabled={!dueValid}
                  >
                    <CalendarIcon />
                    {maxDue ? (
                      formatDateTime(maxDue)
                    ) : dueValid ? (
                      <span>Pick a date</span>
                    ) : (
                      <span>Pick due date first</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  {maxDue && (
                    <Calendar
                      mode="single"
                      selected={maxDue
                        .setZone("local", { keepLocalTime: true })
                        .toJSDate()}
                      disabled={(date) => {
                        if (!due?.isValid) return true;
                        return (
                          DateTime.fromJSDate(date)
                            .setZone("Asia/Hong_Kong", {
                              keepLocalTime: true,
                            })
                            .setLocale("en-HK")
                            .startOf("day") < due.startOf("day")
                        );
                      }}
                      defaultMonth={maxDue
                        .setZone("local", { keepLocalTime: true })
                        .toJSDate()}
                      onSelect={(date) => {
                        if (date && due?.isValid && maxDue) {
                          const extensionDateTime = withTime(
                            DateTime.fromJSDate(date)
                              .setZone("Asia/Hong_Kong", {
                                keepLocalTime: true,
                              })
                              .setLocale("en-HK"),
                            maxDue,
                          );
                          if (extensionDateTime >= due) {
                            const extension = extensionDateTime
                              .diff(due)
                              .toISO();
                            field.onChange(extension ?? "P0D");
                          }
                        }
                      }}
                      captionLayout="dropdown"
                      startMonth={new Date(2020, 0)}
                      endMonth={new Date(2030, 11)}
                      className="rounded-lg border shadow-sm"
                      formatters={{
                        formatMonthDropdown: (date) => formatMonth(date),
                      }}
                    />
                  )}
                </PopoverContent>
              </Popover>
              <TimePicker
                id="assignment-max-extension-time"
                value={maxDue?.toFormat("HH:mm:ss") ?? ""}
                disabled={!maxDue}
                label="Latest due date after extension"
                className="max-w-none flex-1"
                onChange={(value) => {
                  if (due?.isValid && maxDue) {
                    const selectedTime = fromISO(value);
                    const extensionDateTime = selectedTime.isValid
                      ? withTime(maxDue, selectedTime)
                      : null;
                    if (extensionDateTime && extensionDateTime >= due) {
                      const extension = extensionDateTime.diff(due).toISO();
                      field.onChange(extension ?? "P0D");
                    }
                  }
                }}
              />
            </div>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="state"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>State</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a state" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="graded">Graded</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription>
              A graded assignment is required before a student can appeal its
              grade.
            </FieldDescription>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="tas"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>TA in charge</FieldLabel>
            <Textarea placeholder={"ta1@ust.hk\nta2@ust.hk"} {...field} />
            <FieldDescription>
              The emails of the teaching assistants responsible for this
              assignment, one per line. They can view and respond to appeals of
              this assignment.
            </FieldDescription>
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

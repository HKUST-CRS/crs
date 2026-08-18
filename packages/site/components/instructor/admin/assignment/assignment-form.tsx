"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import { DateTime, Duration } from "luxon";
import { Controller, useForm } from "react-hook-form";
import {
  formatDate,
  formatDateTime,
  formatMonth,
  formatTime,
  fromISO,
  toISO,
} from "service/utils/datetime";
import { z } from "zod";
import { TimePicker } from "@/components/shadcn-studio/date-picker/date-picker-08";
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

  const due = fromISO(form.watch("due"));
  const dueValid = due.isValid;
  const maxExtension = Duration.fromISO(form.watch("maxExtension"));
  const maxDueCandidate =
    dueValid && maxExtension.isValid ? due.plus(maxExtension) : null;
  const maxDue = maxDueCandidate?.isValid ? maxDueCandidate : null;

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
        render={({ field, fieldState }) => (
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
                    {dueValid ? formatDate(due) : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={dueValid ? due.toJSDate() : undefined}
                    defaultMonth={
                      dueValid ? due.toJSDate() : DateTime.now().toJSDate()
                    }
                    onSelect={(date) => {
                      if (date) {
                        const currentValue = dueValid
                          ? due
                          : DateTime.now().endOf("day");

                        const updated = DateTime.fromJSDate(date)
                          .setZone("Asia/Hong_Kong", { keepLocalTime: true })
                          .setLocale("en-HK")
                          .set({
                            hour: currentValue.hour,
                            minute: currentValue.minute,
                            second: currentValue.second,
                            millisecond: currentValue.millisecond,
                          });
                        field.onChange(toISO(updated));
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
                value={dueValid ? formatTime(due) : ""}
                disabled={!dueValid}
                label="Due date"
                className="max-w-none flex-1"
                onChange={(value) => {
                  if (dueValid) {
                    const [hour, minute] = value.split(":").map(Number);
                    field.onChange(
                      toISO(
                        due.set({
                          hour,
                          minute,
                          second: 59,
                          millisecond: 999,
                        }),
                      ),
                    );
                  }
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
                      selected={maxDue.toJSDate()}
                      disabled={(date) =>
                        DateTime.fromJSDate(date)
                          .setZone("Asia/Hong_Kong", {
                            keepLocalTime: true,
                          })
                          .setLocale("en-HK")
                          .startOf("day") < due.startOf("day")
                      }
                      defaultMonth={maxDue.toJSDate()}
                      onSelect={(date) => {
                        if (date) {
                          const extensionDateTime = DateTime.fromJSDate(date)
                            .setZone("Asia/Hong_Kong", {
                              keepLocalTime: true,
                            })
                            .setLocale("en-HK")
                            .set({
                              hour: maxDue.hour,
                              minute: maxDue.minute,
                              second: maxDue.second,
                              millisecond: maxDue.millisecond,
                            });
                          if (extensionDateTime >= due) {
                            field.onChange(
                              extensionDateTime.diff(due).toISO() ?? "P0D",
                            );
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
                value={maxDue ? formatTime(maxDue) : ""}
                disabled={!maxDue}
                label="Latest due date after extension"
                className="max-w-none flex-1"
                onChange={(value) => {
                  if (maxDue) {
                    const [hour, minute] = value.split(":").map(Number);
                    const extensionDateTime = maxDue.set({
                      hour,
                      minute,
                      second: 59,
                      millisecond: 999,
                    });
                    if (extensionDateTime >= due) {
                      field.onChange(
                        extensionDateTime.diff(due).toISO() ?? "P0D",
                      );
                    }
                  }
                }}
              />
            </div>
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

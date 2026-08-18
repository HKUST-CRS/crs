"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus, Trash } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { emailsToText, parseEmails } from "../emails";
import type { SectionRow } from "./section-table";

export const SectionFormSchema = z.object({
  code: z.string().min(1, "Code is required"),
  schedule: z.array(
    z.object({
      day: z.number(),
      from: z.string().min(1, "From is required"),
      to: z.string().min(1, "To is required"),
    }),
  ),
  type: z.enum(["Lecture", "Tutorial", "Lab"]).optional(),
  lecturers: z.string(),
});

export type SectionFormSchema = z.infer<typeof SectionFormSchema>;

export const SectionSubmissionSchema = SectionFormSchema.omit({
  lecturers: true,
}).extend({
  lecturers: z.array(z.string()).optional(),
});

export type SectionSubmissionSchema = z.infer<typeof SectionSubmissionSchema>;

export function SectionForm({
  defaultValues,
  onSubmit,
  onRemove,
}: {
  defaultValues?: SectionRow;
  onSubmit: (v: SectionSubmissionSchema) => void;
  onRemove: () => void;
}) {
  const form = useForm<SectionFormSchema>({
    resolver: zodResolver(SectionFormSchema),
    defaultValues: defaultValues
      ? {
          ...defaultValues,
          lecturers: emailsToText(defaultValues.lecturers),
        }
      : {
          code: "",
          schedule: [],
          lecturers: "",
        },
  });

  const handleSubmit = (data: SectionFormSchema) => {
    const { lecturers, ...rest } = data;
    onSubmit({ ...rest, lecturers: parseEmails(lecturers) });
  };

  const schedule = useFieldArray({
    control: form.control,
    name: "schedule",
  });

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
            <FieldLabel>Code</FieldLabel>
            <Input placeholder="L1/T1/LA1/..." {...field} />
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="type"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Type</FieldLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select a section type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Lecture">Lecture</SelectItem>
                <SelectItem value="Tutorial">Tutorial</SelectItem>
                <SelectItem value="Lab">Lab</SelectItem>
              </SelectContent>
            </Select>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <Controller
        name="lecturers"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field>
            <FieldLabel>Lecturers</FieldLabel>
            <Textarea
              placeholder={"lecturer@ust.hk\nother@ust.hk"}
              {...field}
            />
            <FieldDescription>
              The emails of the lecturers responsible for this section, one per
              line. These lecturers are the instructors involved in any appeal
              raised from this section.
            </FieldDescription>
            <FieldError errors={[fieldState.error]} />
          </Field>
        )}
      />

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>Schedule</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => schedule.append({ day: 1, from: "", to: "" })}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Time
          </Button>
        </div>
        {schedule.fields.map((field, index) => {
          return (
            <div key={field.id} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Controller
                  control={form.control}
                  name={`schedule.${index}.day`}
                  render={({ field }) => (
                    <Field className="flex-1">
                      <Select
                        onValueChange={(v) =>
                          field.onChange(v ? Number(v) : undefined)
                        }
                        value={String(field.value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Mon</SelectItem>
                          <SelectItem value="2">Tue</SelectItem>
                          <SelectItem value="3">Wed</SelectItem>
                          <SelectItem value="4">Thu</SelectItem>
                          <SelectItem value="5">Fri</SelectItem>
                          <SelectItem value="6">Sat</SelectItem>
                          <SelectItem value="7">Sun</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                  )}
                />
                <Controller
                  name={`schedule.${index}.from`}
                  control={form.control}
                  render={({ field }) => (
                    <Field className="flex-0">
                      <Input type="time" step={60 * 10} {...field} />
                    </Field>
                  )}
                />
                -
                <Controller
                  name={`schedule.${index}.to`}
                  control={form.control}
                  render={({ field }) => (
                    <Field className="flex-0">
                      <Input type="time" step={60 * 10} {...field} />
                    </Field>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => schedule.remove(index)}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-col">
                <FieldError
                  errors={[form.formState.errors.schedule?.[index]?.day]}
                />
                <FieldError
                  errors={[form.formState.errors.schedule?.[index]?.from]}
                />
                <FieldError
                  errors={[form.formState.errors.schedule?.[index]?.to]}
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

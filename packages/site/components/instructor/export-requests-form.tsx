"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { CourseID, Courses } from "service/models";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTRPC } from "@/lib/trpc-client";
import { Skeleton } from "../ui/skeleton";

export const ExportRequestsFormSchema = z.object({
  course: CourseID,
});

export type ExportRequestsFormSchema = z.infer<typeof ExportRequestsFormSchema>;

export function ExportRequestsForm({
  onSubmit,
}: {
  onSubmit: (v: ExportRequestsFormSchema) => void;
}) {
  const trpc = useTRPC();

  const coursesQuery = useQuery(
    trpc.course.getAllFromEnrollment.queryOptions(["instructor", "observer"]),
  );
  const courses = coursesQuery.data;

  const form = useForm<ExportRequestsFormSchema>({
    resolver: zodResolver(ExportRequestsFormSchema),
  });

  return (
    <form
      onSubmit={form.handleSubmit(onSubmit)}
      className="grid grid-cols-2 gap-4"
    >
      <Controller
        name="course"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field className="col-span-full">
            <FieldLabel>Course</FieldLabel>
            {coursesQuery.isLoading ? (
              <Skeleton className="h-10" />
            ) : (
              <Select
                value={field.value && Courses.id2str(field.value)}
                onValueChange={(v) => field.onChange(Courses.str2id(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a course" />
                </SelectTrigger>
                <SelectContent>
                  {courses?.map((course) => (
                    <SelectItem
                      key={Courses.id2str(course)}
                      value={Courses.id2str(course)}
                    >
                      {Courses.formatCourse(course)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <FieldError errors={[fieldState.error]} />
            <FieldDescription>
              Select the course to export requests from.
            </FieldDescription>
          </Field>
        )}
      />

      <DialogFooter className="col-span-full gap-2">
        <Button type="submit">Export as CSV</Button>
      </DialogFooter>
    </form>
  );
}

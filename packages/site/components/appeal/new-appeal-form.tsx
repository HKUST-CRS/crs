"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Courses } from "service/models";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
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
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/lib/trpc-client";

export const NewAppealFormSchema = z.object({
  course: z.object({ code: z.string(), term: z.string() }),
  assignment: z.string().min(1, "Assignment is required"),
  message: z.string().nonempty("Message is required"),
});
export type NewAppealFormSchema = z.infer<typeof NewAppealFormSchema>;

export function NewAppealForm() {
  const router = useRouter();
  const trpc = useTRPC();

  const coursesQuery = useQuery(
    trpc.course.getAllFromEnrollment.queryOptions(["student"]),
  );
  const courses = coursesQuery.data;

  const createAppeal = useMutation(trpc.appeal.create.mutationOptions());

  const form = useForm<NewAppealFormSchema>({
    resolver: zodResolver(NewAppealFormSchema),
    defaultValues: {
      course: { code: "", term: "" },
      assignment: "",
      message: "",
    },
  });

  const courseID = form.watch("course");
  const course = courses?.find(
    (c) => c.code === courseID?.code && c.term === courseID?.term,
  );
  const gradedAssignments = Object.entries(course?.assignments ?? {}).filter(
    ([, assignment]) => assignment.state === "graded",
  );

  const handleSubmit = (data: NewAppealFormSchema) => {
    const promise = createAppeal.mutateAsync({
      init: { course: data.course, assignment: data.assignment },
      message: { content: data.message },
    });
    toast.promise(promise, {
      loading: "Opening the appeal...",
      success: (id) => {
        router.replace(`/appeal/${id}`);
        return "Appeal opened successfully!";
      },
      error: (err) => `Cannot open the appeal: ${err.message}`,
    });
  };

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="flex flex-col gap-4"
    >
      {courses === undefined ? (
        <Spinner variant="ellipsis" />
      ) : (
        <>
          <Controller
            name="course"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Course</FieldLabel>
                <Select
                  value={field.value.code ? Courses.id2str(field.value) : ""}
                  onValueChange={(v) => field.onChange(Courses.str2id(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a course" />
                  </SelectTrigger>
                  <SelectContent>
                    {courses.map((c) => (
                      <SelectItem
                        key={Courses.id2str(c)}
                        value={Courses.id2str(c)}
                      >
                        {c.code} - {c.term}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            name="assignment"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Assignment</FieldLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={!course}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a graded assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradedAssignments.map(([code, assignment]) => (
                      <SelectItem key={code} value={code}>
                        <strong>{code}</strong> {assignment.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FieldDescription>
                  Only graded assignments can be appealed.
                </FieldDescription>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Controller
            name="message"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Message</FieldLabel>
                <Textarea
                  rows={4}
                  placeholder="Explain what you think is wrong with your 
  grade."
                  {...field}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />

          <Button type="submit">Open Appeal</Button>
        </>
      )}
    </form>
  );
}

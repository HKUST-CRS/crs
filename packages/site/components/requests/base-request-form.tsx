"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { type FC, useEffect } from "react";
import { useForm } from "react-hook-form";
import { CourseId, Requests, RequestType } from "service/models";
import z from "zod";
import {
  currentUser,
  findCourse,
  findInstructors,
} from "@/components/_test-data";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const BaseRequestFormSchema = z.object({
  type: RequestType,
  course: CourseId,
});
export type BaseRequestFormSchema = z.infer<typeof BaseRequestFormSchema>;

export type BaseRequestFormProps = {
  default?: BaseRequestFormSchema;

  className?: string;
} & (
  | {
      viewonly?: false;
      onSubmit: (data: BaseRequestFormSchema) => void;
    }
  | {
      viewonly: true;
    }
);

export const BaseRequestForm: FC<BaseRequestFormProps> = (props) => {
  const viewonly = props.viewonly ?? false;
  const onSubmit = props.viewonly ? () => {} : props.onSubmit;

  const form = useForm<BaseRequestFormSchema>({
    resolver: zodResolver(BaseRequestFormSchema),
    defaultValues: props.default,
  });

  const course = form.watch("course");
  const type = form.watch("type");

  useEffect(() => {
    if (course && type) {
      form.handleSubmit(onSubmit)();
    }
  }, [form.handleSubmit, onSubmit, course, type]);

  const Wrapper = viewonly ? "div" : "form";

  return (
    <Form {...form}>
      <Wrapper
        className={clsx("grid grid-cols-12 gap-x-8 gap-y-4", props.className)}
      >
        {/* Course */}
        <FormField
          name="course"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-6">
              <FormLabel>Course & Class Section</FormLabel>
              <FormControl>
                <Select
                  value={field.value?.code}
                  onValueChange={(code) => field.onChange(findCourse({ code }))}
                  disabled={viewonly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Course" />
                  </SelectTrigger>
                  <SelectContent>
                    {currentUser.enrollment.map((enrollment) => {
                      const course = findCourse(enrollment);
                      if (!course)
                        throw new Error(
                          `Course not found: ${enrollment.code} ${enrollment.term}`,
                        );
                      return (
                        // TODO: filter enrollment
                        // - for role with "student" only
                        // - for term with current term only
                        <SelectItem value={course.code} key={course.code}>
                          <span>
                            <b>{course.code}</b> - {course.title}
                          </span>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormDescription>
                The course & (lecture) class section you want to make the
                request for.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Instructor */}
        <FormItem className="col-span-6">
          <FormLabel>Instructor</FormLabel>
          <FormControl>
            <div>
              {course &&
                findInstructors(course).map((instructor) => (
                  <div key={instructor.email}>
                    {instructor.name}
                    <br />
                    <a
                      href={`mailto:${instructor.email}`}
                      className="underline"
                    >
                      {instructor.email}
                    </a>
                  </div>
                ))}
            </div>
          </FormControl>
          <FormDescription>
            The course instructor of your course section, which handles the
            request.
          </FormDescription>
          <FormMessage />
        </FormItem>

        {/* Request Type */}
        <FormField
          name="type"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-6">
              <FormLabel>Request Type</FormLabel>
              <FormControl>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={viewonly || !course}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Request Type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Requests.map((schema) => (
                      <SelectItem
                        value={schema.shape.type.value}
                        key={schema.shape.type.value}
                      >
                        {schema.meta()?.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormDescription>What type is the request?</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </Wrapper>
    </Form>
  );
};

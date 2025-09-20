"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { FC } from "react";
import { useForm } from "react-hook-form";
import { CourseId, Requests, RequestType } from "service/models";
import z from "zod";
import {
  currentUser,
  findCourse,
  findInstructors,
} from "@/components/_test-data";
import { Button } from "@/components/ui/button";
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
  onSubmit: (data: BaseRequestFormSchema) => void;
};

export const BaseRequestForm: FC<BaseRequestFormProps> = ({ onSubmit }) => {
  const form = useForm<BaseRequestFormSchema>({
    resolver: zodResolver(BaseRequestFormSchema),
  });

  const course = form.watch("course");

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid grid-cols-12 gap-x-8 gap-y-4 m-4"
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

        <div className="col-span-full flex flex-col items-end">
          <Button type="submit" className="">
            Next
          </Button>
        </div>
      </form>
    </Form>
  );
};

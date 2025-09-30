"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { type FC, useEffect } from "react";
import { useForm } from "react-hook-form";
import { CourseId, Courses, Requests, RequestType } from "service/models";
import z from "zod";
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
import { useTRPC } from "@/lib/trpc-client";

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

  const trpc = useTRPC();

  const enrollment = useQuery(
    trpc.course.getEnrollment.queryOptions("yhliaf@connect.ust.hk"),
  ).data;

  const courseId = form.watch("course");
  const type = form.watch("type");

  const courseQuery = useQuery(
    trpc.course.get.queryOptions(courseId, { enabled: !!courseId }),
  );
  const course = courseQuery.data;

  const instrucotrsQuery = useQuery(
    trpc.user.instructorsOf.queryOptions(courseId, { enabled: !!courseId }),
  );
  const instructors = instrucotrsQuery.data;

  useEffect(() => {
    if (courseId && type) {
      form.handleSubmit(onSubmit)();
    }
  }, [form.handleSubmit, onSubmit, courseId, type]);

  const Wrapper = viewonly ? "div" : "form";

  console.debug({
    props,
    courseId,
    type,
    course,
    instructors,
  });

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
                  value={Courses.id2str(field.value)}
                  onValueChange={(idStr) => {
                    if (idStr.length) {
                      field.onChange(Courses.str2id(idStr));
                    }
                  }}
                  disabled={viewonly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Course" />
                  </SelectTrigger>
                  <SelectContent>
                    {(enrollment ?? []).map((course) => {
                      return (
                        <SelectItem
                          key={Courses.id2str(course)}
                          value={Courses.id2str(course)}
                        >
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
              {instructors?.map((instructor) => (
                <div key={instructor.email}>
                  {instructor.name}
                  <br />
                  <a href={`mailto:${instructor.email}`} className="underline">
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

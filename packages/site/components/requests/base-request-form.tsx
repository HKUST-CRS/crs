"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { keyBy } from "es-toolkit";
import { type FC, useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { Class, Classes, Courses, Requests, RequestType } from "service/models";
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
import { Skeleton } from "../ui/skeleton";

export const BaseRequestFormSchema = z.object({
  type: RequestType,
  class: Class,
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

  const userQuery = useQuery(trpc.user.get.queryOptions());
  const user = userQuery.data;

  const enrollmentQuery = useQuery(trpc.course.getEnrollment.queryOptions());
  const enrollment = useMemo(
    () =>
      enrollmentQuery.data &&
      keyBy(enrollmentQuery.data, (c) => Courses.id2str(c)),
    [enrollmentQuery],
  );

  const clazz = form.watch("class");
  const type = form.watch("type");

  const courseQuery = useQuery(
    // biome-ignore lint/style/noNonNullAssertion: enabled by clazz
    trpc.course.get.queryOptions(clazz?.course!, { enabled: !!clazz }),
  );
  const course = courseQuery.data;

  const instructorsQuery = useQuery(
    trpc.user.getAllFromClass.queryOptions(
      // biome-ignore lint/style/noNonNullAssertion: enabled by clazz
      { class: clazz!, role: "instructor" },
      { enabled: !!clazz },
    ),
  );
  const instructors = instructorsQuery.data;

  console.log({ instructors });

  useEffect(() => {
    if (clazz && type) {
      form.handleSubmit(onSubmit)();
    }
  }, [form.handleSubmit, onSubmit, clazz, type]);

  const Wrapper = viewonly ? "div" : "form";

  return (
    <Form {...form}>
      <Wrapper
        className={clsx("grid grid-cols-12 gap-x-8 gap-y-4", props.className)}
      >
        {/* Class */}
        <FormField
          name="class"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-6">
              <FormLabel>Class (Course & Section)</FormLabel>
              {user && enrollment ? (
                <FormControl>
                  <Select
                    value={field.value && Classes.id2str(field.value)}
                    onValueChange={(idStr) => {
                      if (idStr.length) {
                        field.onChange(Classes.str2id(idStr));
                      }
                    }}
                    disabled={viewonly}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Choose a class" />
                    </SelectTrigger>
                    <SelectContent>
                      {user.enrollment
                        .filter((e) => e.role === "student")
                        .map((e) => {
                          const c = enrollment[Courses.id2str(e.course)];
                          return (
                            <SelectItem
                              key={Classes.id2str(e)}
                              value={Classes.id2str(e)}
                            >
                              <span>
                                <b>{c.code}</b> - {c.title} (<b>{e.section}</b>)
                              </span>
                            </SelectItem>
                          );
                        })}
                    </SelectContent>
                  </Select>
                </FormControl>
              ) : (
                <Skeleton className="h-10" />
              )}
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
            {instructors ? (
              <div>
                {instructors?.map((instructor) => (
                  <div key={instructor.email}>
                    {instructor.name}
                    <br />
                    <a href={`mailto:${instructor.email}`}>
                      <u>{instructor.email}</u>
                    </a>
                  </div>
                ))}
              </div>
            ) : (
              <Skeleton className="h-10" />
            )}
          </FormControl>
          <FormDescription>
            The course instructor of your course section, who is also
            responsible for handling the request.
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

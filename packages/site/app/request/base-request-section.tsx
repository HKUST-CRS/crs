"use client";

import type { FC } from "react";
import { Requests } from "service/models";
import { findCourse, findInstructors } from "@/components/_test-data";
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form-static";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BaseRequestFormSchema } from "./base-request-form";

export type BaseRequestSectionProps = {
  data: BaseRequestFormSchema;
};

export const BaseRequestSection: FC<BaseRequestSectionProps> = ({ data }) => {
  const course = findCourse(data.course);
  if (!course) {
    return null;
  }

  const instructors = findInstructors(course);

  return (
    <>
      {/* Course */}
      <FormItem className="col-span-6">
        <FormLabel>Course & Class Section</FormLabel>
        <FormControl>
          <Select disabled={true} defaultValue={course.code}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={course.code} key={course.code}>
                <span>
                  <b>{course.code}</b> - {course.title}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
        </FormControl>
        <FormDescription>
          The course & (lecture) class section you want to make the request for.
        </FormDescription>
        <FormMessage />
      </FormItem>

      {/* Instructor */}
      <FormItem className="col-span-6">
        <FormLabel>Instructor</FormLabel>
        <FormControl>
          <div>
            {instructors.map((instructor) => (
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
      <FormItem className="col-span-6">
        <FormLabel>Request Type</FormLabel>
        <FormControl>
          <Select disabled={true} defaultValue={data.type}>
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
    </>
  );
};

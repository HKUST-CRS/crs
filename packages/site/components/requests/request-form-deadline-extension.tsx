import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { CalendarIcon } from "lucide-react";
import { DateTime, Duration } from "luxon";
import type { FC } from "react";
import { useForm } from "react-hook-form";
import { DeadlineExtensionMeta } from "service/models";
import type z from "zod";
import { findAssignment, findCourse } from "@/components/_test-data";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
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
import type { BaseRequestFormSchema } from "./base-request-form";
import { RequestFormDetails } from "./details-request-form";
import { FormSchema } from "./schema";

export const DeadlineExtensionFormSchema = FormSchema(DeadlineExtensionMeta);
export type DeadlineExtensionFormSchema = z.infer<
  typeof DeadlineExtensionFormSchema
>;

export type DeadlineExtensionRequestFormProps = {
  viewonly?: boolean;
  base: BaseRequestFormSchema;
  default?: DeadlineExtensionFormSchema;

  className?: string;
};

export const DeadlineExtensionRequestForm: FC<
  DeadlineExtensionRequestFormProps
> = (props) => {
  const form = useForm<DeadlineExtensionFormSchema>({
    resolver: zodResolver(DeadlineExtensionFormSchema),
    defaultValues: props.default,
  });

  const { viewonly = false, base } = props;

  const course = findCourse(base.course);

  const assignment = course && findAssignment(course, form.watch("assignment"));
  const deadline = DateTime.fromISO(form.watch("deadline"));

  const isMetaDone = assignment && deadline.isValid;

  const Wrapper = viewonly ? "div" : "form";

  return (
    <Form {...form}>
      <Wrapper
        className={clsx("grid grid-cols-12 gap-x-8 gap-y-4", props.className)}
      >
        <FormField
          name="assignment"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-8">
              <FormLabel>Assignment</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={viewonly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    {course?.assignments.map((assignment) => {
                      return (
                        <SelectItem
                          key={assignment.code}
                          value={assignment.code}
                        >
                          <strong>{assignment.code}</strong> {assignment.name} -
                          Due{" "}
                          {DateTime.fromISO(assignment.due).toLocaleString()}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          )}
        />
        <FormField
          name="deadline"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-4">
              <FormLabel>New Deadline</FormLabel>
              <FormControl>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={viewonly || !assignment}
                    >
                      <CalendarIcon />
                      {field.value ? (
                        DateTime.fromISO(field.value).toLocaleString()
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    {assignment && (
                      <Calendar
                        mode="single"
                        selected={DateTime.fromISO(field.value).toJSDate()}
                        onSelect={(date) => {
                          if (date) {
                            field.onChange(
                              DateTime.fromJSDate(date).toISODate(),
                            );
                          }
                        }}
                        disabled={{
                          before: DateTime.fromISO(assignment.due).toJSDate(),
                          after: DateTime.fromISO(assignment.due)
                            .plus(Duration.fromISO(assignment.maxExtension))
                            .toJSDate(),
                        }}
                        className="rounded-lg border shadow-sm"
                      />
                    )}
                  </PopoverContent>
                </Popover>
              </FormControl>
            </FormItem>
          )}
        />
        {isMetaDone &&
          (() => {
            return (
              <div className="col-span-full typo-muted">
                You are requesting to extend the deadline of assignment{" "}
                <strong>
                  {assignment.code} {assignment.name}
                </strong>{" "}
                (due{" "}
                <strong>
                  {DateTime.fromISO(assignment.due).toLocaleString()}
                </strong>
                ) to <strong>{deadline.toLocaleString()}</strong>.
              </div>
            );
          })()}
        {isMetaDone && <RequestFormDetails form={form} viewonly={viewonly} />}
      </Wrapper>
    </Form>
  );
};

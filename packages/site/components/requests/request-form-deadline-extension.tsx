import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { CalendarIcon } from "lucide-react";
import { DateTime, Duration } from "luxon";
import { type FC, type ReactNode, useCallback } from "react";
import { useForm } from "react-hook-form";
import { DeadlineExtensionMeta } from "service/models";
import { formatDateTime, fromISO, toISO } from "service/utils/datetime";
import type z from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
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
import { useTRPC } from "@/lib/trpc-client";
import type { BaseRequestFormSchema } from "./base-request-form";
import { RequestFormDetails } from "./details-request-form";
import { FormSchema } from "./schema";

export const DeadlineExtensionFormSchema = FormSchema(
  "Deadline Extension",
  DeadlineExtensionMeta,
);
export type DeadlineExtensionFormSchema = z.infer<
  typeof DeadlineExtensionFormSchema
>;

export type DeadlineExtensionRequestFormProps = {
  viewonly?: boolean;
  base: BaseRequestFormSchema;
  default?: DeadlineExtensionFormSchema;
  onSubmit?: (data: DeadlineExtensionFormSchema) => void;

  className?: string;
};

export const DeadlineExtensionRequestForm: FC<
  DeadlineExtensionRequestFormProps
> = (props) => {
  const form = useForm<DeadlineExtensionFormSchema>({
    resolver: zodResolver(DeadlineExtensionFormSchema),
    defaultValues: {
      type: "Deadline Extension",
      details: {
        reason: "",
        proof: [],
      },
      ...props.default,
    },
  });

  const { viewonly = false, base, onSubmit = () => {} } = props;

  const trpc = useTRPC();
  const course = useQuery(trpc.course.get.queryOptions(base.class.course)).data;

  const assignmentCode = form.watch("meta.assignment");
  const assignment = course?.assignments?.[assignmentCode];

  const deadline = fromISO(form.watch("meta.deadline"));
  const isMetaDone = assignment && deadline.isValid;

  const Wrapper = useCallback(
    (props: { className: string; children: ReactNode }) => {
      if (viewonly) {
        return <div className={props.className}>{props.children}</div>;
      } else {
        return (
          <form
            className={props.className}
            onSubmit={(e) => {
              form.handleSubmit(onSubmit, (err) => {
                console.error("DeadlineExtension form submission error", err);
              })(e);
            }}
          >
            {props.children}
          </form>
        );
      }
    },
    [form.handleSubmit, onSubmit, viewonly],
  );

  return (
    <Form {...form}>
      <Wrapper
        className={clsx(
          "grid grid-cols-6 gap-x-8 gap-y-4 md:grid-cols-12",
          props.className,
        )}
      >
        <FormField
          name="meta.assignment"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-6 md:col-span-8">
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
                    {Object.entries(course?.assignments ?? {}).map(
                      ([code, assignment]) => {
                        return (
                          <SelectItem key={code} value={code}>
                            <strong>{code}</strong> {assignment.name} - Due{" "}
                            {formatDateTime(assignment.due)}
                          </SelectItem>
                        );
                      },
                    )}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="meta.deadline"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-6 md:col-span-4">
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
                        formatDateTime(field.value)
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    {assignment && (
                      <Calendar
                        mode="single"
                        selected={fromISO(field.value).toJSDate()}
                        onSelect={(date) => {
                          if (date) {
                            field.onChange(
                              toISO(DateTime.fromJSDate(date).endOf("day")),
                            );
                          }
                        }}
                        disabled={{
                          before: fromISO(assignment.due).toJSDate(),
                          after: fromISO(assignment.due)
                            .plus(Duration.fromISO(assignment.maxExtension))
                            .toJSDate(),
                        }}
                        className="rounded-lg border shadow-sm"
                      />
                    )}
                  </PopoverContent>
                </Popover>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {isMetaDone &&
          (() => {
            return (
              <div className="typo-muted col-span-full">
                You are requesting to extend the deadline of assignment{" "}
                <strong>
                  {assignmentCode} {assignment.name}
                </strong>{" "}
                (due <strong>{formatDateTime(assignment.due)}</strong>) to{" "}
                <strong>{formatDateTime(deadline)}</strong>.
              </div>
            );
          })()}
        {isMetaDone && <RequestFormDetails form={form} viewonly={viewonly} />}
      </Wrapper>
    </Form>
  );
};

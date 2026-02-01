import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { CalendarIcon } from "lucide-react";
import { DateTime } from "luxon";
import { type FC, type ReactNode, useCallback } from "react";
import { useForm } from "react-hook-form";
import { AbsentFromSectionMeta } from "service/models";
import { DateFormatter, TimeFormatter } from "service/utils/datetime";
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

export const AbsentFromSectionFormSchema = FormSchema(
  "Absent from Section",
  AbsentFromSectionMeta,
);
export type AbsentFromSectionFormSchema = z.infer<
  typeof AbsentFromSectionFormSchema
>;

export type AbsentFromSectionRequestFormProps = {
  viewonly?: boolean;
  base: BaseRequestFormSchema;
  default?: AbsentFromSectionFormSchema;

  onSubmit?: (data: AbsentFromSectionFormSchema) => void;

  className?: string;
};

export const AbsentFromSectionRequestForm: FC<
  AbsentFromSectionRequestFormProps
> = (props) => {
  const form = useForm<AbsentFromSectionFormSchema>({
    resolver: zodResolver(AbsentFromSectionFormSchema),
    defaultValues: {
      type: "Absent from Section",
      details: {
        reason: "",
        proof: [],
      },
      ...props.default,
    },
  });

  const { viewonly = false, base, onSubmit = () => {} } = props;

  const trpc = useTRPC();
  const courseQuery = useQuery(trpc.course.get.queryOptions(base.class.course));
  const course = courseQuery.data;

  const fromSectionCode = form.watch("meta.fromSection");
  const fromSection = course?.sections?.[fromSectionCode];

  const fromDate = DateTime.fromISO(form.watch("meta.fromDate"));

  console.log({
    fromSectionRaw: form.watch("meta.fromSection"),
    fromDateRaw: form.watch("meta.fromDate"),
    fromSection: fromSection,
    fromDate: fromDate,
  });

  const isMetaDone = fromSection && fromDate.isValid;

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
                console.error("AbsentFromSection form submission error", err);
              })(e);
            }}
          >
            {props.children}
          </form>
        );
      }
    },
    [viewonly, form.handleSubmit, onSubmit],
  );

  return (
    <Form {...form}>
      <Wrapper
        className={clsx(
          "grid grid-cols-12 gap-x-8 gap-y-4",
          viewonly && "pointer-events-none",
          props.className,
        )}
      >
        <FormField
          name="meta.fromSection"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>From Section...</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={viewonly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="From Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(course?.sections || {}).map(
                      ([code, _section]) => {
                        return (
                          <SelectItem key={code} value={code}>
                            {code}
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
          name="meta.fromDate"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-4">
              <FormLabel>From Date...</FormLabel>
              <FormControl>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      disabled={viewonly || !fromSection}
                    >
                      <CalendarIcon />
                      {field.value ? (
                        DateTime.fromISO(field.value).toFormat(DateFormatter)
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    {fromSection && (
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
                          dayOfWeek: [0, 1, 2, 3, 4, 5, 6].filter(
                            (d) =>
                              !fromSection.schedule.some(
                                // 0 is Sunday in the calendar component, but
                                // 7 is Sunday in DateTime
                                (s) => s.day === (d === 0 ? 7 : d),
                              ),
                          ),
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
            const fromSchedule = fromSection.schedule
              .filter((s) => s.day === fromDate.weekday)
              .map(
                (s) =>
                  DateTime.fromISO(s.from).toFormat(TimeFormatter) +
                  " - " +
                  DateTime.fromISO(s.to).toFormat(TimeFormatter),
              )
              .join(", ");
            return (
              <div className="typo-muted col-span-full">
                You are requesting to be absent from section{" "}
                <strong>{fromSectionCode} </strong>on{" "}
                <strong>
                  {fromDate.toFormat(DateFormatter)} ({fromSchedule})
                </strong>
                .
              </div>
            );
          })()}
        {isMetaDone && <RequestFormDetails form={form} viewonly={viewonly} />}
      </Wrapper>
    </Form>
  );
};

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { CalendarIcon } from "lucide-react";
import { DateTime } from "luxon";
import { type FC, type ReactNode, useCallback } from "react";
import { useForm } from "react-hook-form";
import { SwapSectionMeta } from "service/models";
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

export const SwapSectionFormSchema = FormSchema(
  "Swap Section",
  SwapSectionMeta,
);
export type SwapSectionFormSchema = z.infer<typeof SwapSectionFormSchema>;

export type SwapSectionRequestFormProps = {
  viewonly?: boolean;
  base: BaseRequestFormSchema;
  default?: SwapSectionFormSchema;

  onSubmit?: (data: SwapSectionFormSchema) => void;

  className?: string;
};

export const SwapSectionRequestForm: FC<SwapSectionRequestFormProps> = (
  props,
) => {
  const form = useForm<SwapSectionFormSchema>({
    resolver: zodResolver(SwapSectionFormSchema),
    defaultValues: {
      type: "Swap Section",
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
  const toSectionCode = form.watch("meta.toSection");
  const toSection = course?.sections?.[toSectionCode];

  const fromDate = DateTime.fromISO(form.watch("meta.fromDate"));
  const toDate = DateTime.fromISO(form.watch("meta.toDate"));

  console.log({
    fromSectionRaw: form.watch("meta.fromSection"),
    toSectionRaw: form.watch("meta.toSection"),
    fromDateRaw: form.watch("meta.fromDate"),
    toDateRaw: form.watch("meta.toDate"),
    fromSection,
    toSection,
    fromDate,
    toDate,
  });

  const isMetaDone =
    fromSection && toSection && fromDate.isValid && toDate.isValid;

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
                console.error("SwapSection form submission error", err);
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
                        DateTime.fromISO(field.value).toLocaleString()
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
                                (s) => (d === 6 ? 7 : s.day) === d,
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
        <FormField
          name="meta.toSection"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>To Section...</FormLabel>
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
                    {Object.entries(course?.sections ?? {}).map(
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
          name="meta.toDate"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-4">
              <FormLabel>To Date...</FormLabel>
              <FormControl>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" disabled={viewonly || !toSection}>
                      <CalendarIcon />
                      {field.value ? (
                        DateTime.fromISO(field.value).toLocaleString()
                      ) : (
                        <span>Pick a date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    {toSection && (
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
                              !toSection.schedule.some(
                                (s) => (d === 6 ? 7 : s.day) === d,
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
                  DateTime.fromISO(s.from).toLocaleString(
                    DateTime.TIME_SIMPLE,
                  ) +
                  " - " +
                  DateTime.fromISO(s.to).toLocaleString(DateTime.TIME_SIMPLE),
              )
              .join(", ");
            const toSchedule = toSection.schedule
              .filter((s) => s.day === toDate.weekday)
              .map(
                (s) =>
                  DateTime.fromISO(s.from).toLocaleString(
                    DateTime.TIME_SIMPLE,
                  ) +
                  " - " +
                  DateTime.fromISO(s.to).toLocaleString(DateTime.TIME_SIMPLE),
              )
              .join(", ");
            return (
              <div className="typo-muted col-span-full">
                You are requesting to swap from section{" "}
                <strong>{fromSectionCode} </strong>on{" "}
                <strong>
                  {fromDate.toLocaleString()} ({fromSchedule})
                </strong>{" "}
                to section <strong>{toSectionCode}</strong> on{" "}
                <strong>
                  {toDate.toLocaleString()} ({toSchedule})
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

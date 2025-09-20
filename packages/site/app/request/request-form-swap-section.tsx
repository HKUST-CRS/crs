import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import { DateTime } from "luxon";
import type { FC } from "react";
import { useForm } from "react-hook-form";
import { SwapSectionMeta } from "service/models";
import type z from "zod";
import { findCourse, findSection } from "@/components/_test-data";
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
import { BaseRequestSection } from "./base-request-section";
import { RequestFormDetails } from "./details-request-form";
import { FormSchema } from "./schema";

export type SwapSectionRequestFormProps = {
  dataBase: BaseRequestFormSchema;
};

export const SwapSectionFormSchema = FormSchema(SwapSectionMeta);
export type SwapSectionFormSchema = z.infer<typeof SwapSectionFormSchema>;

export const SwapSectionRequestForm: FC<SwapSectionRequestFormProps> = (
  props,
) => {
  const form = useForm<SwapSectionFormSchema>({
    resolver: zodResolver(SwapSectionFormSchema),
  });

  const { dataBase } = props;

  const course = findCourse(dataBase.course);
  const fromSection = course && findSection(course, form.watch("fromSection"));
  const toSection = course && findSection(course, form.watch("toSection"));

  const fromDate = DateTime.fromISO(form.watch("fromDate"));
  const toDate = DateTime.fromISO(form.watch("toDate"));

  const isMetaDone =
    fromSection && toSection && fromDate.isValid && toDate.isValid;

  return (
    <Form {...form}>
      <form className="grid grid-cols-12 gap-x-8 gap-y-4 m-4">
        <div className="col-span-full grid grid-cols-12 gap-x-8 gap-y-4">
          <BaseRequestSection data={dataBase} />
        </div>
        <FormField
          name="fromSection"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>From Section...</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="From Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {course?.sections.map((section) => {
                      return (
                        <SelectItem key={section.code} value={section.code}>
                          {section.code}
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
          name="fromDate"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-4">
              <FormLabel>From Date...</FormLabel>
              <FormControl>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" disabled={!fromSection}>
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
            </FormItem>
          )}
        />
        <FormField
          name="toSection"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-2">
              <FormLabel>To Section...</FormLabel>
              <FormControl>
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="From Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {course?.sections.map((section) => {
                      return (
                        <SelectItem key={section.code} value={section.code}>
                          {section.code}
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
          name="toDate"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-4">
              <FormLabel>To Date...</FormLabel>
              <FormControl>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" disabled={!toSection}>
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
              <div className="col-span-full typo-muted">
                You are requesting to swap from section{" "}
                <strong>{fromSection.code} </strong>on{" "}
                <strong>
                  {fromDate.toLocaleString()} ({fromSchedule})
                </strong>{" "}
                to section <strong>{toSection.code}</strong> on{" "}
                <strong>
                  {toDate.toLocaleString()} ({toSchedule})
                </strong>
                .
              </div>
            );
          })()}
        {isMetaDone && <RequestFormDetails form={form} />}
      </form>
    </Form>
  );
};

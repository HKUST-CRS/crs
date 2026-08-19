import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { CalendarIcon } from "lucide-react";
import { DateTime, Duration } from "luxon";
import {
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useForm } from "react-hook-form";
import { DeadlineExtensionMeta } from "service/models";
import {
  formatDate,
  formatDateTime,
  formatMonth,
  fromISO,
  toISO,
  withTime,
} from "service/utils/datetime";
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
import { TimePicker } from "../shadcn-studio/date-picker/date-picker-08";
import type { BaseRequestFormSchema } from "./base-request-form";
import { RequestFormComment } from "./request-form-comment";
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
  default?: Partial<DeadlineExtensionFormSchema>;
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
      comment: {
        text: "",
        proofs: [],
      },
      ...props.default,
    },
  });

  const initialDeadline = fromISO(props.default?.meta?.deadline ?? "");
  const [deadlineDate, setDeadlineDate] = useState<DateTime | null>(
    initialDeadline.isValid ? initialDeadline.startOf("day") : null,
  );
  const [deadlineTime, setDeadlineTime] = useState<DateTime | null>(
    initialDeadline.isValid ? initialDeadline : null,
  );
  const deadline = useMemo(
    () =>
      deadlineDate && deadlineTime
        ? withTime(deadlineDate, deadlineTime)
        : null,
    [deadlineDate, deadlineTime],
  );
  useEffect(() => {
    form.setValue("meta.deadline", deadline?.isValid ? toISO(deadline) : "");
  }, [deadline, form]);

  const { viewonly = false, base, onSubmit = () => {} } = props;

  const trpc = useTRPC();
  const course = useQuery(trpc.course.get.queryOptions(base.class.course)).data;

  const assignmentCode = form.watch("meta.assignment");
  const assignment = course?.assignments?.[assignmentCode];
  const assignmentDue = assignment ? fromISO(assignment.due) : null;
  const latestDeadlineCandidate =
    assignment && assignmentDue?.isValid
      ? assignmentDue.plus(Duration.fromISO(assignment.maxExtension))
      : null;
  const latestDeadline = latestDeadlineCandidate?.isValid
    ? latestDeadlineCandidate
    : null;

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
            <FormItem className="col-span-6">
              <FormLabel>Assignment</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={(value) => {
                    field.onChange(value);
                    setDeadlineDate(null);
                    const due = fromISO(course?.assignments[value]?.due ?? "");
                    setDeadlineTime(due.isValid ? due : null);
                  }}
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
          render={() => (
            <FormItem className="col-span-6">
              <FormLabel>New Deadline</FormLabel>
              <FormControl>
                <div className="flex gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        disabled={viewonly || !assignment}
                        className="flex-1"
                      >
                        <CalendarIcon />
                        {deadline?.isValid ? (
                          formatDateTime(deadline)
                        ) : deadlineDate ? (
                          formatDate(deadlineDate)
                        ) : (
                          <span>Pick a date</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      {assignment && (
                        <Calendar
                          mode="single"
                          selected={deadlineDate
                            ?.setZone("local", { keepLocalTime: true })
                            .toJSDate()}
                          defaultMonth={
                            deadlineDate
                              ? deadlineDate
                                  .setZone("local", { keepLocalTime: true })
                                  .toJSDate()
                              : assignmentDue?.isValid
                                ? assignmentDue
                                    .setZone("local", {
                                      keepLocalTime: true,
                                    })
                                    .toJSDate()
                                : new Date()
                          }
                          onSelect={(date) => {
                            if (date && assignmentDue?.isValid) {
                              const selectedDate = DateTime.fromJSDate(date)
                                .setZone("Asia/Hong_Kong", {
                                  keepLocalTime: true,
                                })
                                .setLocale("en-HK")
                                .startOf("day");
                              setDeadlineDate(selectedDate);
                            }
                          }}
                          disabled={(date) => {
                            if (!assignmentDue?.isValid) return true;
                            const selectedDate = DateTime.fromJSDate(date)
                              .setZone("Asia/Hong_Kong", {
                                keepLocalTime: true,
                              })
                              .setLocale("en-HK")
                              .startOf("day");
                            return (
                              selectedDate < assignmentDue.startOf("day") ||
                              (latestDeadline !== null &&
                                selectedDate > latestDeadline.startOf("day"))
                            );
                          }}
                          captionLayout="dropdown"
                          startMonth={new Date(2020, 0)}
                          endMonth={new Date(2030, 11)}
                          className="rounded-lg border shadow-sm"
                          formatters={{
                            formatMonthDropdown: (date) => formatMonth(date),
                          }}
                        />
                      )}
                    </PopoverContent>
                  </Popover>
                  <TimePicker
                    id="request-deadline-time"
                    value={deadlineTime?.toFormat("HH:mm:ss") ?? ""}
                    disabled={viewonly || !assignment || !deadlineDate}
                    label="New deadline"
                    className="max-w-none flex-1"
                    onChange={(value) => {
                      const selectedTime = fromISO(value);
                      setDeadlineTime(
                        selectedTime.isValid ? selectedTime : null,
                      );
                    }}
                  />
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {assignment && deadline?.isValid && (
          <div className="typo-muted col-span-full">
            You are requesting to extend the deadline of assignment{" "}
            <strong>
              {assignmentCode} {assignment.name}
            </strong>{" "}
            (due <strong>{formatDateTime(assignment.due)}</strong>) to{" "}
            <strong>{formatDateTime(deadline)}</strong>.
          </div>
        )}
        {assignment && deadline?.isValid && (
          <RequestFormComment form={form} viewonly={viewonly} />
        )}
      </Wrapper>
    </Form>
  );
};

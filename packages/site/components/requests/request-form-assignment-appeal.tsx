import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { type FC, type ReactNode, useCallback } from "react";
import { useForm } from "react-hook-form";
import { AssignmentAppealMeta } from "service/models";
import { formatDateTime } from "service/utils/datetime";
import type z from "zod";
import {
  Form,
  FormControl,
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
import type { BaseRequestFormSchema } from "./base-request-form";
import { RequestFormComment } from "./request-form-comment";
import { FormSchema } from "./schema";

export const AssignmentAppealFormSchema = FormSchema(
  "Assignment Appeal",
  AssignmentAppealMeta,
);
export type AssignmentAppealFormSchema = z.infer<
  typeof AssignmentAppealFormSchema
>;

export type AssignmentAppealRequestFormProps = {
  viewonly?: boolean;
  base: BaseRequestFormSchema;
  default?: Partial<AssignmentAppealFormSchema>;
  onSubmit?: (data: AssignmentAppealFormSchema) => void;

  className?: string;
};

export const AssignmentAppealRequestForm: FC<
  AssignmentAppealRequestFormProps
> = (props) => {
  const form = useForm<AssignmentAppealFormSchema>({
    resolver: zodResolver(AssignmentAppealFormSchema),
    defaultValues: {
      type: "Assignment Appeal",
      comment: {
        text: "",
        proofs: [],
      },
      ...props.default,
    },
  });

  const { viewonly = false, base, onSubmit = () => {} } = props;

  const trpc = useTRPC();
  const course = useQuery(trpc.course.get.queryOptions(base.class.course)).data;

  const assignmentCode = form.watch("meta.assignment");
  const assignment = course?.assignments?.[assignmentCode];
  // Only graded assignments can be appealed.
  const gradedAssignments = Object.entries(course?.assignments ?? {}).filter(
    ([, a]) => a.state === "graded",
  );
  const isMetaDone = !!assignment;

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
                console.error("AssignmentAppeal form submission error", err);
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
                    <SelectValue placeholder="Select a graded assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    {gradedAssignments.length === 0 ? (
                      <SelectItem value="placeholder" disabled>
                        No graded assignments are available to appeal.
                      </SelectItem>
                    ) : (
                      gradedAssignments.map(([code, assignment]) => {
                        return (
                          <SelectItem key={code} value={code}>
                            <strong>{code}</strong> {assignment.name} - Due{" "}
                            {formatDateTime(assignment.due)}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {isMetaDone &&
          (() => {
            return (
              <div className="typo-muted col-span-full">
                You are appealing the grade of assignment{" "}
                <strong>
                  {assignmentCode} {assignment.name}
                </strong>
                . The reason and any supporting documents below are sent as your
                opening message.
              </div>
            );
          })()}
        {isMetaDone && <RequestFormComment form={form} viewonly={viewonly} />}
      </Wrapper>
    </Form>
  );
};

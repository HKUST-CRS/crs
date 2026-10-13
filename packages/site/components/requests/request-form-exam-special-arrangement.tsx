"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { ExamSpecialArrangementMeta } from "service/models";
import type z from "zod";
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
import { Spinner } from "@/components/ui/spinner";
import { useTRPC } from "@/lib/trpc-client";
import type { BaseRequestFormSchema } from "./base-request-form";
import { RequestFormComment } from "./request-form-comment";
import { FormSchema } from "./schema";

export const ExamSpecialArrangementFormSchema = FormSchema(
  "Exam Special Arrangement",
  ExamSpecialArrangementMeta,
);
export type ExamSpecialArrangementFormSchema = z.infer<
  typeof ExamSpecialArrangementFormSchema
>;

export function ExamSpecialArrangementRequestForm(props: {
  base: BaseRequestFormSchema;
  default?: Partial<ExamSpecialArrangementFormSchema>;
  viewonly?: boolean;
  pending?: boolean;
  onSubmit?: (data: ExamSpecialArrangementFormSchema) => void;
}) {
  const { viewonly = false, onSubmit = () => {} } = props;
  const trpc = useTRPC();
  const courseQuery = useQuery(
    trpc.course.get.queryOptions(props.base.class.course),
  );
  const form = useForm<ExamSpecialArrangementFormSchema>({
    resolver: zodResolver(ExamSpecialArrangementFormSchema),
    defaultValues: {
      type: "Exam Special Arrangement",
      meta: { examCode: "" },
      comment: { text: "", proofs: [] },
      ...props.default,
    },
  });

  if (courseQuery.isPending) return <Spinner variant="ellipsis" />;
  if (courseQuery.error)
    return (
      <p role="alert">Could not load exams: {courseQuery.error.message}</p>
    );
  if (
    !viewonly &&
    !courseQuery.data?.effectiveRequestTypes["Exam Special Arrangement"]
  )
    return (
      <p className="typo-muted">
        This request type is not enabled for this course. Please contact your
        course instructor.
      </p>
    );
  const exams = Object.keys(courseQuery.data?.exams ?? {}).sort();
  if (!exams.length)
    return (
      <p className="typo-muted">
        No exams are configured. Please contact your course instructor.
      </p>
    );
  const busy = props.pending || form.formState.isSubmitting;
  const Wrapper = viewonly ? "div" : "form";

  return (
    <Form {...form}>
      <Wrapper
        className="grid grid-cols-1 gap-4"
        onSubmit={viewonly ? undefined : form.handleSubmit(onSubmit)}
      >
        <fieldset disabled={viewonly || busy} className="contents">
          <FormField
            name="meta.examCode"
            control={form.control}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Exam</FormLabel>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={viewonly || busy}
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Exam" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {exams.map((exam) => (
                      <SelectItem key={exam} value={exam}>
                        {exam}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormDescription>
                  The exam you need an arrangement for.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          {!viewonly && (
            <p className="typo-muted text-sm">
              Describe the arrangement you need in your reason, for example a
              make-up exam or an absence. You can attach supporting documents.
            </p>
          )}
          <RequestFormComment form={form} viewonly={viewonly} />
        </fieldset>
      </Wrapper>
    </Form>
  );
}

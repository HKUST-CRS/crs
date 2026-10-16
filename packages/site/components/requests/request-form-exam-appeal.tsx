"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useForm } from "react-hook-form";
import { CommentInit, ExamAppealMeta } from "service/models";
import { toast } from "sonner";
import z from "zod";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/lib/trpc-client";
import type { BaseRequestFormSchema } from "./base-request-form";
import { FormSchema } from "./schema";

const ExamAppealFormSchema = FormSchema("Exam Appeal", ExamAppealMeta).extend({
  comment: CommentInit.extend({
    text: z.string().trim().min(1, "Please provide an appeal reason."),
  }),
});
type FormValues = z.infer<typeof ExamAppealFormSchema>;

export function ExamAppealRequestForm({
  base,
  onPendingChange,
}: {
  base: BaseRequestFormSchema;
  onPendingChange: (pending: boolean) => void;
}) {
  const trpc = useTRPC();
  const router = useRouter();
  const courseQuery = useQuery(trpc.course.get.queryOptions(base.class.course));
  const mutation = useMutation(trpc.request.create.mutationOptions());
  const submitting = useRef(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(ExamAppealFormSchema),
    defaultValues: {
      type: "Exam Appeal",
      meta: { examCode: "", question: "" },
      comment: { text: "", proofs: [] },
    },
  });

  const onSubmit = async (data: FormValues) => {
    if (submitting.current) return;
    submitting.current = true;
    onPendingChange(true);
    const toastId = toast.loading("Submitting the request...");
    try {
      const id = await mutation.mutateAsync({
        request: { class: base.class, type: data.type, metadata: data.meta },
        comment: data.comment,
      });
      toast.success("Request submitted successfully!", { id: toastId });
      router.replace(`/request/${id}`);
    } catch (error) {
      const message = `Cannot submit the request: ${error instanceof Error ? error.message : String(error)}`;
      toast.error(message, { id: toastId });
      form.setError("root", { message });
    } finally {
      submitting.current = false;
      onPendingChange(false);
    }
  };

  if (courseQuery.isPending) return <Spinner variant="ellipsis" />;
  if (courseQuery.error)
    return (
      <p role="alert">Could not load exams: {courseQuery.error.message}</p>
    );
  const exams = courseQuery.data?.exams ?? {};
  if (!Object.keys(exams).length)
    return (
      <p className="typo-muted">
        No exams are configured. Please contact your course instructor.
      </p>
    );
  const busy = form.formState.isSubmitting;
  const selectedExamCode = form.watch("meta.examCode");
  const selectedQuestion = form.watch("meta.question");
  const questions = exams[selectedExamCode]?.questions ?? {};
  const questionIDs = Object.keys(questions);
  const assignedGrader = questions[selectedQuestion]?.grader;

  return (
    <Form {...form}>
      <form
        className="grid grid-cols-1 gap-6 md:grid-cols-2"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <FormField
          name="meta.examCode"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Exam</FormLabel>
              <Select
                value={field.value}
                onValueChange={(value) => {
                  field.onChange(value);
                  form.setValue("meta.question", "");
                }}
                disabled={busy}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Exam" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {Object.keys(exams)
                    .sort()
                    .map((code) => (
                      <SelectItem key={code} value={code}>
                        {code}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="meta.question"
          control={form.control}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Question</FormLabel>
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={busy || !selectedExamCode || !questionIDs.length}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Question" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {questionIDs.map((question) => (
                    <SelectItem key={question} value={question}>
                      {question}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>
                {assignedGrader ? (
                  <>
                    Assigned grader:{" "}
                    <span className="break-all">{assignedGrader}</span>
                  </>
                ) : selectedExamCode && !questionIDs.length ? (
                  "No questions are configured for this exam. Contact your course instructor."
                ) : (
                  "Choose the question to review."
                )}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="comment.text"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-full">
              <FormLabel>Appeal Reason</FormLabel>
              <FormControl>
                <Textarea
                  {...field}
                  disabled={busy}
                  placeholder="Explain the grading issue for this question..."
                />
              </FormControl>
              <FormDescription>
                Your reason opens the question’s request thread. You can add
                supporting documents there.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {form.formState.errors.root?.message && (
          <p role="alert" className="col-span-full text-destructive text-sm">
            {form.formState.errors.root.message}
          </p>
        )}
        <div className="col-span-full flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Submitting..." : "Submit"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

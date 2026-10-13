"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { ExaminationAppealBatch } from "service/models";
import { toast } from "sonner";
import type z from "zod";
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

const FormSchema = ExaminationAppealBatch.pick({ appeals: true });
type FormValues = z.infer<typeof FormSchema>;
const emptyAppeal = () => ({
  examCode: "",
  questionNumber: "",
  comment: { text: "" },
});

export function ExaminationAppealRequestForm({
  base,
  onPendingChange,
}: {
  base: BaseRequestFormSchema;
  onPendingChange: (pending: boolean) => void;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();
  const courseQuery = useQuery(trpc.course.get.queryOptions(base.class.course));
  const mutation = useMutation(
    trpc.request.createExaminationAppeals.mutationOptions(),
  );
  const retry = useRef<{ fingerprint: string; submissionId: string } | null>(
    null,
  );
  const submitting = useRef(false);
  const form = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: { appeals: [emptyAppeal()] },
  });
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "appeals",
  });
  const onSubmit = async (data: FormValues) => {
    if (submitting.current) return;
    submitting.current = true;
    onPendingChange(true);
    const payload = { class: base.class, appeals: data.appeals };
    const fingerprint = JSON.stringify(payload);
    if (retry.current?.fingerprint !== fingerprint) {
      retry.current = { fingerprint, submissionId: crypto.randomUUID() };
    }
    const toastId = toast.loading("Submitting appeals…");
    try {
      const ids = await mutation.mutateAsync({
        submissionId: retry.current.submissionId,
        ...payload,
      });
      toast.success(
        `${ids.length} ${ids.length === 1 ? "appeal" : "appeals"} submitted.`,
        { id: toastId },
      );
      await queryClient.invalidateQueries({ queryKey: trpc.request.pathKey() });
      router.replace(ids.length === 1 ? `/request/${ids[0]}` : "/");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not submit appeals.",
        { id: toastId },
      );
      form.setError("root", {
        message:
          "Submission could not be confirmed. Retry without editing to reuse this submission and avoid duplicate requests.",
      });
    } finally {
      submitting.current = false;
      onPendingChange(false);
    }
  };

  if (courseQuery.isPending) return <Spinner variant="ellipsis" />;
  if (courseQuery.error)
    return (
      <p role="alert">
        Could not load examinations: {courseQuery.error.message}
      </p>
    );
  const examinations = courseQuery.data?.examinations ?? {};
  if (!Object.keys(examinations).length)
    return (
      <p className="typo-muted">
        No examinations are configured. Please contact your course instructor.
      </p>
    );
  const busy = form.formState.isSubmitting;

  return (
    <Form {...form}>
      <form
        className="flex flex-col gap-6"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <p className="typo-muted text-sm">
          Each question creates its own request thread for the assigned TA. All
          questions in this submission are saved together.
        </p>
        <div className="space-y-6">
          {fields.map((item, index) => {
            const selectedExamCode = form.watch(`appeals.${index}.examCode`);
            const questions = examinations[selectedExamCode]?.questions ?? [];
            const questionNumber = form.watch(
              `appeals.${index}.questionNumber`,
            );
            const assignedTA = questions.find(
              (question) => question.questionNumber === questionNumber,
            )?.taId;
            return (
              <div
                key={item.id}
                className="grid grid-cols-1 gap-4 rounded-lg border bg-slate-50/50 p-5 md:grid-cols-12 dark:bg-transparent"
              >
                <div className="flex items-center justify-between border-b pb-2 md:col-span-12">
                  <h4 className="font-semibold">Appeal Item #{index + 1}</h4>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      onClick={() => remove(index)}
                      aria-label={`Remove appeal item ${index + 1}`}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Remove
                    </Button>
                  )}
                </div>
                <FormField
                  name={`appeals.${index}.examCode`}
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="md:col-span-6">
                      <FormLabel>Examination</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(value) => {
                          field.onChange(value);
                          form.setValue(`appeals.${index}.questionNumber`, "");
                        }}
                        disabled={busy}
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select Examination" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.keys(examinations)
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
                  name={`appeals.${index}.questionNumber`}
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="md:col-span-6">
                      <FormLabel>Question</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={
                          busy || !selectedExamCode || !questions.length
                        }
                      >
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select Question" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {questions.map((question) => (
                            <SelectItem
                              key={question.questionNumber}
                              value={question.questionNumber}
                            >
                              {question.questionNumber}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        {assignedTA ? (
                          <>
                            Assigned TA:{" "}
                            <span className="break-all">{assignedTA}</span>
                          </>
                        ) : selectedExamCode && !questions.length ? (
                          "No questions are configured for this examination. Contact your course instructor."
                        ) : (
                          "Choose the question to review."
                        )}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  name={`appeals.${index}.comment.text`}
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="md:col-span-12">
                      <FormLabel>Appeal Reason</FormLabel>
                      <FormControl>
                        <Textarea
                          {...field}
                          disabled={busy}
                          placeholder="Explain the grading issue for this question…"
                        />
                      </FormControl>
                      <FormDescription>
                        Your reason opens the question’s request thread. You can
                        add supporting documents there.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            );
          })}
        </div>
        {(form.formState.errors.appeals?.message ||
          form.formState.errors.appeals?.root?.message) && (
          <p role="alert" className="text-destructive text-sm">
            {form.formState.errors.appeals.message ||
              form.formState.errors.appeals.root?.message}
          </p>
        )}
        <Button
          type="button"
          variant="outline"
          className="w-full border-2 border-dashed"
          disabled={busy || fields.length >= 50}
          onClick={() => append(emptyAppeal())}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Another Question
        </Button>
        {form.formState.errors.root?.message && (
          <p role="alert" className="text-destructive text-sm">
            {form.formState.errors.root.message}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Submitting…" : "Submit"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

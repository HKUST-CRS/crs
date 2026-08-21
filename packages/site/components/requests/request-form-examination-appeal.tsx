import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { Plus, Trash2 } from "lucide-react"; 
import { type FC, type ReactNode, useCallback } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { ExaminationAppealMeta } from "service/models";
import type z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

import type { BaseRequestFormSchema } from "./base-request-form";
import { FormSchema } from "./schema";

import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc-client";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const ExaminationAppealFormSchema = FormSchema(
  "Examination Appeal",
  ExaminationAppealMeta,
);
export type ExaminationAppealFormSchema = z.infer<typeof ExaminationAppealFormSchema>;

export type ExaminationAppealRequestFormProps = {
  viewonly?: boolean;
  base: BaseRequestFormSchema;
  default?: ExaminationAppealFormSchema;
  onSubmit?: (data: ExaminationAppealFormSchema) => void;
  className?: string;
};

export const ExaminationAppealRequestForm: FC<ExaminationAppealRequestFormProps> = (
  props,
) => {
  const trpc = useTRPC();
  const { data: course } = useQuery({
      ...trpc.course.get.queryOptions(props.base.class.course),
      enabled: !!props.base.class.course,
    });
  
  const form = useForm<ExaminationAppealFormSchema>({
    resolver: zodResolver(ExaminationAppealFormSchema),
    defaultValues: {
      type: "Examination Appeal",
      details: {
        reason: "N/A - Reasons are provided in individual appeal items.", 
        proof: [],
      },
      meta: {
        appeals: [{ examCode: "", questionNumber: "", reason: "" } as any], 
      },
      ...props.default, 
    },
  });

  const { viewonly = false, onSubmit = () => {} } = props;

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "meta.appeals", 
  });

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
                console.error("Examination form submission error", err);
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
          "flex flex-col gap-6",
          viewonly && "pointer-events-none",
          props.className,
        )}
      >
        <div className="space-y-6">
          {fields.map((field, index) => {
            const selectedExamCode = form.watch(`meta.appeals.${index}.examCode` as any);
            const availableQuestions = selectedExamCode && course?.examinations
              ? course.examinations[selectedExamCode]?.questions || []
              : [];

            return (
              <div
                key={field.id}
                className="relative grid grid-cols-1 gap-4 p-5 border rounded-lg dark:bg-transparent bg-slate-50/50 md:grid-cols-12"
              >
                <div className="flex items-center justify-between col-span-1 pb-2 border-b md:col-span-12 border-slate-200">
                  <h4 className="font-semibold">
                    Appeal Item #{index + 1}
                  </h4>
                  {!viewonly && fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => remove(index)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>

                <FormField
                  name={`meta.appeals.${index}.examCode` as any}
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="col-span-1 md:col-span-3">
                      <FormLabel>Examination</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={(val) => {
                            field.onChange(val);
                            form.setValue(`meta.appeals.${index}.questionNumber` as any, "");
                          }}
                          value={field.value}
                          disabled={viewonly}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Exam" />
                          </SelectTrigger>
                          <SelectContent>
                            {course?.examinations && Object.keys(course.examinations).map((code) => (
                              <SelectItem key={code} value={code}>
                                {code}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name={`meta.appeals.${index}.questionNumber` as any}
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="col-span-1 md:col-span-3">
                      <FormLabel>Question</FormLabel>
                      <FormControl>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={viewonly || !selectedExamCode} 
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select Question" />
                          </SelectTrigger>
                          <SelectContent>
                            {availableQuestions.map((q) => (
                              <SelectItem key={q.questionNumber} value={q.questionNumber}>
                                {q.questionNumber}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  name={`meta.appeals.${index}.reason` as any}
                  control={form.control}
                  render={({ field }) => (
                    <FormItem className="col-span-1 md:col-span-12">
                      <FormLabel>Appeal Reason</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Explain why this question deserves a different score..."
                          disabled={viewonly}
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            );
          })}
        </div>

        {!viewonly && (
          <Button
            type="button"
            variant="outline"
            className="w-full border-2 border-dashed hover:text-primary hover:border-primary"
            onClick={() =>
              append({ examCode: "", questionNumber: "", reason: "" } as any)
            }
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Another Question
          </Button>
        )}

        {!viewonly && (
          <div className="flex justify-end col-span-full">
            <Button type="submit">Submit</Button>
          </div>
        )}
      </Wrapper>
    </Form>
  );
};
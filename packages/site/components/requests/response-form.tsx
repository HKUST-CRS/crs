"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import clsx from "clsx";
import { type ReactNode, useCallback } from "react";
import { useForm } from "react-hook-form";
import { type Request, Response, ResponseDecision } from "service/models";
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
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/lib/trpc-client";
import RequestForm from "./request-form";

export const ResponseFormSchema = Response.omit({
  from: true,
  timestamp: true,
});
export type ResponseFormSchema = z.infer<typeof ResponseFormSchema>;

export type ResponseFormProps = {
  viewonly?: boolean;
  request: Request;

  onSubmit?: () => void;
};

export default function ResponseForm(props: ResponseFormProps) {
  const { viewonly = false, request, onSubmit = () => {} } = props;

  const form = useForm<ResponseFormSchema>({
    resolver: zodResolver(ResponseFormSchema),
    defaultValues: request.response ?? undefined,
  });

  const trpc = useTRPC();
  const createResponse = useMutation(trpc.response.create.mutationOptions());

  const handleSubmit = useCallback(
    async (data: ResponseFormSchema) => {
      console.log({ message: "Submit Response", id: request.id, data });
      const promise = createResponse.mutateAsync({
        id: request.id,
        init: data,
      });
      toast.promise(promise, {
        loading: "Submitting the response...",
        success: () => {
          console.log({
            message: "Submitted Response",
            id: request.id,
            data,
          });
          onSubmit();
          return "Response submitted successfully!";
        },
        error: (err) =>
          `Failed to submit response: ${err?.message ?? String(err)}`,
      });
    },
    [createResponse, request.id, onSubmit],
  );

  const Wrapper = useCallback(
    (props: { className: string; children: ReactNode }) => {
      if (viewonly) {
        return <div className={props.className}>{props.children}</div>;
      } else {
        return (
          <form
            className={props.className}
            onSubmit={(e) => {
              form.handleSubmit(handleSubmit, (err) => {
                console.error("Response form submission error", err);
              })(e);
            }}
          >
            {props.children}
          </form>
        );
      }
    },
    [form.handleSubmit, handleSubmit, viewonly],
  );

  return (
    <Form {...form}>
      <Wrapper className={clsx("m-4 grid grid-cols-12 gap-x-8 gap-y-4")}>
        <RequestForm
          default={request}
          viewonly
          className="col-span-full mb-4"
        />

        <FormField
          name="remarks"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-full">
              <FormLabel>Remarks</FormLabel>
              <FormControl>
                <Textarea {...field} disabled={viewonly} />
              </FormControl>
              <FormDescription>
                Remarks regarding the decision to the student.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="decision"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-full">
              <FormLabel>Decision</FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={viewonly}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Decision" />
                  </SelectTrigger>
                  <SelectContent>
                    {[...ResponseDecision.values.values()].map((v) => (
                      <SelectItem key={v} value={v}>
                        <b>
                          {v === "Approve" ? (
                            <span className="text-green-800">{v}</span>
                          ) : v === "Reject" ? (
                            <span className="text-red-800">{v}</span>
                          ) : (
                            v
                          )}
                        </b>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormDescription>
                Decision: Approve or Reject the request.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {!viewonly && (
          <div className="col-span-full mt-4 flex justify-end">
            <Button type="submit">Submit</Button>
          </div>
        )}
      </Wrapper>
    </Form>
  );
}

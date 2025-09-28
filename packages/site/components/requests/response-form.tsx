"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { useForm } from "react-hook-form";
import { type Request, Response, ResponseDecision } from "service/models";
import type z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import RequestForm from "./request-form";

export const ResponseFormSchema = Response.omit({
  from: true,
  timestamp: true,
});
export type ResponseFormSchema = z.infer<typeof ResponseFormSchema>;

export type ResponseFormProps = {
  viewonly?: boolean;
  request: Request;
};

export default function ResponseForm(props: ResponseFormProps) {
  const viewonly = props.viewonly ?? false;

  const form = useForm<ResponseFormSchema>({
    resolver: zodResolver(ResponseFormSchema),
  });

  return (
    <Form {...form}>
      <form
        className={clsx(
          "m-4 grid grid-cols-12 gap-x-8 gap-y-4",
          viewonly && "pointer-events-none",
        )}
      >
        <RequestForm
          default={props.request}
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
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormControl>
              <FormDescription>
                Decision: Approve or Reject the request.
              </FormDescription>
            </FormItem>
          )}
        />
        {!viewonly && (
          <div className="col-span-full mt-4 flex justify-end">
            <Button type="submit">Submit</Button>
          </div>
        )}
      </form>
    </Form>
  );
}

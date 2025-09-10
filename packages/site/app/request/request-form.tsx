"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
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
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const formSchema = z.object({
  course: z.string(),
  requestType: z.string(),
  subject: z.string(),
  reason: z.string(),
  proof: z.file().optional(),
});

export default function RequestForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      course: "",
      requestType: "",
      subject: "",
      reason: "",
      proof: undefined,
    },
  });

  function onSubmit(data: z.infer<typeof formSchema>) {
    console.log(data);
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid grid-cols-12 gap-x-8 gap-y-4 m-4"
      >
        <FormField
          name="course"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-6">
              <FormLabel>Course & Class Section</FormLabel>
              <FormControl>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course1">
                      <span>
                        <b>COMP 1023</b> - Introduction to Python Programming (
                        <b>L1</b>)
                      </span>
                    </SelectItem>
                    <SelectItem value="course2">
                      <span>
                        <b>COMP 2211</b> - Exploring Artificial Intelligence (
                        <b>L2</b>)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormDescription>
                The course & (lecture) class section you want to make the
                request for.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem className="col-span-6">
          <FormLabel>Instructor</FormLabel>
          <FormControl>
            <div>
              TSOI, Yau Chat (Desmond)
              <br />
              <a href="mailto:desmond@ust.hk" className="underline">
                desmond@ust.hk
              </a>
            </div>
          </FormControl>
          <FormDescription>
            The course instructor of your course section, which handles the
            request.
          </FormDescription>
          <FormMessage />
        </FormItem>
        <FormField
          name="course"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-4">
              <FormLabel>Request Type</FormLabel>
              <FormControl>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Request Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="r1">Lab Request</SelectItem>
                    <SelectItem value="r2">Assignment Request</SelectItem>
                    <SelectItem value="r3">Exam Request</SelectItem>
                    <SelectItem value="r4">Other Request</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormDescription>What type is the request?</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="course"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-4">
              <FormLabel>Subject</FormLabel>
              <FormControl>
                <Select>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Subject" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="course1">Lab Swap</SelectItem>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormDescription>What is it about?</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          name="reason"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-11">
              <FormLabel>Reason</FormLabel>
              <FormControl>
                <Textarea className="h-48 grow" />
              </FormControl>
              <FormDescription>
                Please provide some information for the instructor to consider
                your request.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          name="proof"
          control={form.control}
          render={({ field }) => (
            <FormItem className="col-span-6">
              <FormLabel>Proof</FormLabel>
              <FormControl>
                <Input type="file" />
              </FormControl>
              <FormDescription>
                (Optional) What documents can support your reason above?
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="col-span-full">
          <Button type="submit">Submit</Button>
        </div>
      </form>
    </Form>
  );
}

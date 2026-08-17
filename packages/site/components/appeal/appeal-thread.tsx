"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { Courses } from "service/models";
import { formatDateTime } from "service/utils/datetime";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/lib/trpc-client";

const PostSchema = z.object({
  content: z.string().nonempty("Message cannot be empty"),
});

type PostSchema = z.infer<typeof PostSchema>;

export function AppealThread({ appealID }: { appealID: string }) {
  const trpc = useTRPC();

  const appealQuery = useQuery(trpc.appeal.get.queryOptions(appealID));

  const postMessage = useMutation(trpc.appeal.post.mutationOptions());

  const form = useForm<PostSchema>({
    resolver: zodResolver(PostSchema),
    defaultValues: { content: "" },
  });

  const handleSubmit = (data: PostSchema) => {
    const promise = postMessage.mutateAsync({
      appealID: appealID,
      message: { content: data.content },
    });
    toast.promise(promise, {
      loading: "Sending...",
      success: () => {
        form.reset();
        appealQuery.refetch();
        return "Message sent!";
      },
      error: (err) => `Failed to send: ${err.message}`,
    });
  };

  const appeal = appealQuery.data;
  if (appeal === undefined) return <Spinner variant="ellipsis" />;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h4 className="typo-h4">
          {Courses.formatID(appeal.course)} · {appeal.assignment}
        </h4>
        <span
          className={
            appeal.state === "open"
              ? "font-medium text-green-800 dark:text-green-400"
              : "text-gray-500"
          }
        >
          {appeal.state}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        {appeal.messages.map((m) => (
          <div key={m.id} className="rounded-md border px-3 py-2">
            <div className="text-gray-500 text-sm">
              {m.from} · {formatDateTime(m.timestamp)}
            </div>
            <p>{m.content}</p>
          </div>
        ))}
      </div>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="flex flex-col gap-2"
      >
        <Controller
          name="content"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel>Message</FieldLabel>
              <Textarea rows={3} placeholder="Write a message..." {...field} />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit">Send</Button>
        </div>
      </form>
    </div>
  );
}

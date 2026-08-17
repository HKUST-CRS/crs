"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  AppealAttachment,
  AppealAttachmentAccept,
  type AppealMessage,
  type CourseID,
  Courses,
  type Role,
  type User,
} from "service/models";
import { formatDateTime } from "service/utils/datetime";
import { toast } from "sonner";
import { z } from "zod";
import {
  downloadBase64File,
  readFileAsBase64,
} from "@/components/requests/utils";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/lib/trpc-client";

const PostSchema = z.object({
  content: z.string().nonempty("Message cannot be empty"),
  attachments: z
    .array(AppealAttachment)
    .max(4, "At most 4 files per message are allowed.")
    .optional(),
});
type PostSchema = z.infer<typeof PostSchema>;

const ROLE_PRIORITY: Role[] = ["admin", "instructor", "observer", "student"];
const ROLE_LABEL: Record<Role, string> = {
  admin: "Admin",
  instructor: "Instructor",
  observer: "Observer",
  student: "Student",
};

const IMAGE_MIME: Record<string, string> = {
  bmp: "image/bmp",
  gif: "image/gif",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  webp: "image/webp",
};

/**
 * The role the user holds in the course, or undefined if the user
 * has no enrollment in the course.
 *
 * Used to decide whether the current viewer can invite others to the appeal.
 * Message badges show `message.role` instead, which is frozen at post time.
 */
function resolveRole(user: User, course: CourseID): Role | undefined {
  const enrollments = user.enrollment.filter(
    (e) => e.course.code === course.code && e.course.term === course.term,
  );
  for (const role of ROLE_PRIORITY) {
    if (enrollments.some((e) => e.role === role)) return role;
  }
  return undefined;
}

export function AppealThread({
  appealID,
  className,
}: {
  appealID: string;
  className?: string;
}) {
  const trpc = useTRPC();

  const appealQuery = useQuery(trpc.appeal.get.queryOptions(appealID));
  const currentUserQuery = useQuery(trpc.user.getCurrent.queryOptions());
  const appeal = appealQuery.data;

  const participantsQuery = useQuery(
    trpc.user.getAllByEmails.queryOptions(appeal?.participants ?? [], {
      enabled: appeal !== undefined,
    }),
  );
  const usersByEmail = useMemo(
    () => new Map((participantsQuery.data ?? []).map((u) => [u.email, u])),
    [participantsQuery.data],
  );

  const postMessage = useMutation(trpc.appeal.post.mutationOptions());
  const invite = useMutation(trpc.appeal.invite.mutationOptions());

  const [inviting, setInviting] = useState(false);
  const [invitee, setInvitee] = useState("");

  const form = useForm<PostSchema>({
    resolver: zodResolver(PostSchema),
    defaultValues: { content: "", attachments: [] },
  });

  const currentUser = currentUserQuery.data;
  const currentUserRole =
    appeal && currentUser ? resolveRole(currentUser, appeal.course) : undefined;
  const canInvite =
    currentUserRole === "instructor" || currentUserRole === "admin";

  const handleSubmit = (data: PostSchema) => {
    const promise = postMessage.mutateAsync({
      appealID,
      message: {
        content: data.content,
        attachments: data.attachments,
      },
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

  const handleInvite = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const promise = invite.mutateAsync({ appealID, invitee });
    toast.promise(promise, {
      loading: "Inviting...",
      success: () => {
        setInvitee("");
        setInviting(false);
        appealQuery.refetch();
        return "Invited!";
      },
      error: (err) => `Cannot invite: ${err.message}`,
    });
  };

  // Keep the latest message in view whenever the thread grows.
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageCount = appeal?.messages.length ?? 0;
  useEffect(() => {
    const el = scrollRef.current;
    if (el && messageCount > 0) el.scrollTop = el.scrollHeight;
  }, [messageCount]);

  if (appeal === undefined) return <Spinner variant="ellipsis" />;

  return (
    <div className={clsx("flex min-h-0 flex-col", className)}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex items-center gap-2">
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
        {canInvite && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setInviting((v) => !v)}
          >
            Invite
          </Button>
        )}
      </header>

      {canInvite && inviting && (
        <form
          onSubmit={handleInvite}
          className="flex items-center gap-2 border-b px-4 py-2"
        >
          <Input
            placeholder="person@ust.hk"
            value={invitee}
            onChange={(e) => setInvitee(e.target.value)}
            className="max-w-xs"
          />
          <Button type="submit" size="sm">
            Invite
          </Button>
        </form>
      )}

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        <ul className="flex flex-col gap-3">
          {appeal.messages.map((m) => (
            <li key={m.id}>
              <MessageBubble
                message={m}
                sender={usersByEmail.get(m.from)}
                // A message is "own" only when the sender is the current user
                // under the role they currently hold. This lets a single
                // account test different roles: messages posted under another
                // role appear on the left as if from a different participant.
                isOwn={
                  m.from === currentUser?.email && m.role === currentUserRole
                }
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="border-t px-4 py-3">
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
                <Textarea
                  rows={2}
                  placeholder="Write a message..."
                  {...field}
                />
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <Controller
            name="attachments"
            control={form.control}
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel>Attachments</FieldLabel>
                <Input
                  type="file"
                  multiple
                  accept={AppealAttachmentAccept.join(",")}
                  onChange={async (e) => {
                    const files = e.target.files ? [...e.target.files] : [];
                    if (files.length === 0) return;
                    const attachments = await Promise.all(
                      files.slice(0, 4).map(async (f) => {
                        const content = await readFileAsBase64(f);
                        return { name: f.name, size: f.size, content };
                      }),
                    );
                    field.onChange(attachments);
                    e.target.value = "";
                  }}
                />
                {field.value && field.value.length > 0 && (
                  <ul className="flex flex-col gap-1">
                    {field.value.map((att, i) => (
                      <li
                        key={att.name + String(i)}
                        className="flex items-center gap-2 text-sm"
                      >
                        <span className="truncate">{att.name}</span>
                        <span className="text-gray-500">
                          ({(att.size / 1024 / 1024).toFixed(2)} MiB)
                        </span>
                        <button
                          type="button"
                          className="cursor-pointer text-gray-500 underline"
                          onClick={() =>
                            field.onChange(
                              field.value?.filter((_, j) => j !== i),
                            )
                          }
                        >
                          remove
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <div className="flex justify-end">
            <Button type="submit">Send</Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  sender,
  isOwn,
}: {
  message: AppealMessage;
  sender?: User;
  isOwn: boolean;
}) {
  const role = message.role;
  const name = sender?.name || message.from;
  return (
    <div className={clsx("flex flex-col", isOwn ? "items-end" : "items-start")}>
      <div
        className={clsx(
          "max-w-[75%] rounded-xl border px-3 py-2",
          isOwn
            ? "border-transparent bg-primary text-primary-foreground"
            : "bg-card text-card-foreground",
        )}
      >
        <div className="mb-1 flex flex-wrap items-center gap-x-2 text-xs opacity-80">
          <span className="font-medium">{name}</span>
          {role && <span>{ROLE_LABEL[role]}</span>}
          <span>{formatDateTime(message.timestamp)}</span>
        </div>
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 flex flex-col gap-1">
            {message.attachments.map((att) => (
              <Attachment key={att.name + att.size} attachment={att} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Attachment({ attachment }: { attachment: AppealAttachment }) {
  const ext = attachment.name.split(".").pop()?.toLowerCase() ?? "";
  const mime = IMAGE_MIME[ext];
  if (mime) {
    return (
      <figure className="flex flex-col gap-1">
        {/* biome-ignore lint/performance/noImgElement: base64 data URLs aren't optimized by next/image */}
        <img
          src={`data:${mime};base64,${attachment.content}`}
          alt={attachment.name}
          className="max-h-64 rounded-md border"
        />
        <figcaption className="flex items-center gap-2 text-sm">
          <button
            type="button"
            className="cursor-pointer underline"
            onClick={() =>
              downloadBase64File(attachment.content, attachment.name)
            }
          >
            {attachment.name}
          </button>
          <span className="opacity-70">
            ({(attachment.size / 1024 / 1024).toFixed(2)} MiB)
          </span>
        </figcaption>
      </figure>
    );
  }
  return (
    <button
      type="button"
      className="cursor-pointer text-left underline"
      onClick={() => downloadBase64File(attachment.content, attachment.name)}
    >
      {attachment.name} ({(attachment.size / 1024 / 1024).toFixed(2)} MiB)
    </button>
  );
}

"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useMemo, useState } from "react";
import type {
  ProofFile,
  Request,
  RequestStatus,
  ThreadEntry,
  User,
} from "service/models";
import { formatDateTime, fromISO } from "service/utils/datetime";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTRPC } from "@/lib/trpc-client";
import RequestForm from "./request-form";
import { downloadBase64File, readFileAsBase64 } from "./utils";

/**
 * `RequestThread` renders the immutable request header (via the viewonly
 * `RequestForm`), the append-only thread of updates (comments + status
 * changes), and a GitHub-style composer: a persistent text box and proof
 * uploader whose action buttons (Comment / Approve / Reject / Appeal / Cancel)
 * submit the current content with the chosen action. Which actions are visible
 * depends on the viewer's role and the request's status.
 */
export type RequestThreadProps = {
  request: Request;
};

export default function RequestThread({ request }: RequestThreadProps) {
  const trpc = useTRPC();
  // Resolve author names for everyone who may appear in the thread. We use the
  // class-scoped roster endpoints (instructors + observers) rather than per-user
  // `user.get`, because a student viewing the thread is not permitted to fetch
  // arbitrary instructor/observer users by id — the roster endpoints are
  // allowed for any class member. The requester and the viewer are covered by
  // `getCurrent` and by the rosters when they are staff.
  const instructors = useQuery(
    trpc.user.getAllFromClass.queryOptions({
      class: request.class,
      role: "instructor",
    }),
  ).data;
  const observers = useQuery(
    trpc.user.getAllFromClass.queryOptions({
      class: request.class,
      role: "observer",
    }),
  ).data;
  const currentUser = useQuery(trpc.user.getCurrent.queryOptions()).data;

  const roster = useMemo(() => {
    const map = new Map<string, User>();
    for (const u of instructors ?? []) map.set(u.email, u);
    for (const u of observers ?? []) map.set(u.email, u);
    if (currentUser) map.set(currentUser.email, currentUser);
    return map;
  }, [instructors, observers, currentUser]);

  // The requester may be a student who is no longer enrolled or otherwise not
  // returned by the roster endpoints; fall back to a direct lookup only for
  // that single email. `user.get` permits reading your own record.
  const requesterQuery = useQuery({
    ...trpc.user.get.queryOptions(request.from),
    enabled: !roster.has(request.from),
  });

  const authors = useMemo(() => {
    if (!requesterQuery.data || roster.has(request.from)) return roster;
    return new Map(roster).set(request.from, requesterQuery.data);
  }, [roster, requesterQuery.data, request.from]);

  const user = currentUser;
  const isRequester = !!user && user.email === request.from;
  const isInstructor =
    !!user &&
    user.enrollment.some(
      (e) =>
        e.course.code === request.class.course.code &&
        e.course.term === request.class.course.term &&
        (e.section === request.class.section || e.section === "*") &&
        e.role === "instructor",
    );
  const isStaff =
    isInstructor ||
    (!!user &&
      user.enrollment.some(
        (e) =>
          e.course.code === request.class.course.code &&
          e.course.term === request.class.course.term &&
          (e.section === request.class.section || e.section === "*") &&
          e.role === "observer",
      ));

  const status = request.status;
  // Comments are allowed for the requester or staff at any point, including
  // after cancellation. Status changes are gated by role and (for re-decision)
  // by the request not being cancelled.
  const canComment = isRequester || isStaff;
  const canDecide = isInstructor && status !== "cancelled";
  const canCancel = isRequester && status !== "cancelled";
  const canAppeal =
    isRequester && (status === "approved" || status === "rejected");

  return (
    <div className="flex flex-col gap-6">
      <StatusBanner status={status} />

      {/* Immutable request header */}
      <RequestForm default={request} viewonly />

      <hr />

      {/* Thread */}
      <section className="flex flex-col gap-3">
        <h4 className="font-medium text-sm">Thread</h4>
        {request.updates.map((entry) => (
          <ThreadEntryView
            key={entry.id}
            entry={entry}
            author={authors.get(entry.from)}
          />
        ))}
      </section>

      <hr />

      <Composer
        request={request}
        canComment={canComment}
        canDecide={canDecide}
        canCancel={canCancel}
        canAppeal={canAppeal}
      />
    </div>
  );
}

const STATUS_STYLE: Record<
  RequestStatus,
  { label: string; className: string }
> = {
  open: {
    label: "Open",
    className: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  approved: {
    label: "Approved",
    className:
      "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  },
  appealed: {
    label: "Appealed",
    className:
      "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
};

function StatusBanner({ status }: { status: RequestStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx("rounded px-2 py-0.5 font-medium text-sm", s.className)}
      >
        {s.label}
      </span>
    </div>
  );
}

function ThreadEntryView({
  entry,
  author,
}: {
  entry: ThreadEntry;
  author?: User;
}) {
  const name = author?.name || entry.from;
  const timestamp = formatDateTime(fromISO(entry.timestamp));
  if (entry.kind === "comment") {
    return (
      <div className="rounded-md border p-3">
        <div className="typo-muted text-sm">
          <b>{name}</b> commented · {timestamp}
        </div>
        <p className="mt-1 whitespace-pre-wrap">{entry.text}</p>
        {entry.proof && entry.proof.length > 0 && (
          <ProofList proof={entry.proof} />
        )}
      </div>
    );
  }
  // status change
  const s = STATUS_STYLE[entry.status];
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={clsx("rounded px-2 py-0.5 font-medium", s.className)}>
        {s.label}
      </span>
      <span className="typo-muted">
        by <b>{name}</b> · {timestamp}
      </span>
    </div>
  );
}
function ProofList({ proof }: { proof: ProofFile[] }) {
  // Attachments carry no stable id, so assign a uuid per file (memoized on the
  // list) and key on it — filenames can repeat across uploads.
  const files = useMemo(
    () => proof.map((file) => ({ file, key: crypto.randomUUID() })),
    [proof],
  );
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {files.map(({ file, key }) => (
        <li key={key}>
          <button
            type="button"
            className="text-blue-700 text-sm underline dark:text-blue-400"
            onClick={() => downloadBase64File(file.content, file.name)}
          >
            {file.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── Composer ────────────────────────────────────────────────────────────────

const MAX_PROOF_FILES = 4;
const MAX_PROOF_FILE_SIZE = 2 * 1024 * 1024; // 2 MiB — matches the backend Proof schema

type ComposerProps = {
  request: Request;
  canComment: boolean;
  canDecide: boolean;
  canCancel: boolean;
  canAppeal: boolean;
};

function Composer({
  request,
  canComment,
  canDecide,
  canCancel,
  canAppeal,
}: ComposerProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const commentM = useMutation(trpc.request.comment.mutationOptions());
  const approveM = useMutation(trpc.request.approve.mutationOptions());
  const rejectM = useMutation(trpc.request.reject.mutationOptions());
  const appealM = useMutation(trpc.request.appeal.mutationOptions());
  const cancelM = useMutation(trpc.request.cancel.mutationOptions());

  const [text, setText] = useState("");
  const [proof, setProof] = useState<ProofFile[] | undefined>(undefined);
  const [proofKey, setProofKey] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const hasText = text.trim().length > 0;
  const pending =
    commentM.isPending ||
    approveM.isPending ||
    rejectM.isPending ||
    appealM.isPending ||
    cancelM.isPending;

  // After a thread action lands, invalidate the request query so the thread
  // refreshes in place. The mutations return no data, so the UI depends on this
  // re-fetch to reflect the new entry / status. (Notifications are best-effort
  // server-side, so a notification failure can no longer reject the mutation
  // and skip this refresh.)
  const refresh = async () => {
    // Invalidate every request.* query — the open thread (request.get) and any
    // list/table query (getAllHeadsAs) the viewer may navigate back to — so a
    // status change or new entry shows up immediately rather than after the
    // 60s stale window.
    await queryClient.invalidateQueries({
      queryKey: trpc.request.pathKey(),
    });
  };

  const clear = () => {
    setText("");
    setProof(undefined);
    setProofKey((k) => k + 1);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const fileArray = [...files];
    if (fileArray.length > MAX_PROOF_FILES) {
      toast.error(`At most ${MAX_PROOF_FILES} files are allowed.`);
      return;
    }
    for (const f of fileArray) {
      if (f.size > MAX_PROOF_FILE_SIZE) {
        toast.error(`"${f.name}" exceeds the 2 MiB limit.`);
        return;
      }
    }
    setProof(
      await Promise.all(
        fileArray.map(async (f) => ({
          name: f.name,
          size: f.size,
          content: await readFileAsBase64(f),
        })),
      ),
    );
  };

  const run = async (
    fn: () => Promise<unknown>,
    messages: { loading: string; success: string },
  ) => {
    // sonner's toast.promise resolves with the toast id immediately (it does
    // NOT await the inner promise), so we must await the mutation ourselves
    // before invalidating — otherwise the refetch races the write and the
    // thread stays one action behind.
    const toastId = toast.loading(messages.loading);
    try {
      await fn();
      toast.success(messages.success, { id: toastId });
      await refresh();
      clear();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Failed: ${msg}`, { id: toastId });
    }
  };

  const noActions = !canComment && !canDecide && !canCancel && !canAppeal;

  return (
    <section className="flex flex-col gap-3">
      <h4 className="font-medium text-sm">Add to thread</h4>
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <Field>
          <FieldLabel htmlFor="composer-text">Comment</FieldLabel>
          <Textarea
            id="composer-text"
            placeholder={
              canDecide
                ? "Add a remark (optional for decisions, required for comments/appeals)"
                : "Add a comment / supplementary information"
            }
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="composer-proof">Supporting documents</FieldLabel>
          <Input
            key={proofKey}
            id="composer-proof"
            type="file"
            multiple
            accept="image/*,application/pdf,text/plain"
            onChange={(e) => void onFiles(e.target.files)}
          />
        </Field>
        <div className="flex flex-wrap justify-end gap-2">
          {canComment && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending || !hasText}
              onClick={() =>
                void run(
                  () => commentM.mutateAsync({ id: request.id, text, proof }),
                  { loading: "Posting comment...", success: "Comment posted." },
                )
              }
            >
              Comment
            </Button>
          )}
          {canDecide && (
            <>
              <Button
                size="sm"
                disabled={pending}
                className="text-green-700 dark:text-green-400"
                variant="outline"
                onClick={() =>
                  void run(
                    () =>
                      approveM.mutateAsync({
                        id: request.id,
                        text: text || undefined,
                        proof,
                      }),
                    {
                      loading: "Approving request...",
                      success: "Request approved.",
                    },
                  )
                }
              >
                Approve
              </Button>
              <Button
                size="sm"
                disabled={pending}
                className="text-red-700 dark:text-red-400"
                variant="outline"
                onClick={() =>
                  void run(
                    () =>
                      rejectM.mutateAsync({
                        id: request.id,
                        text: text || undefined,
                        proof,
                      }),
                    {
                      loading: "Rejecting request...",
                      success: "Request rejected.",
                    },
                  )
                }
              >
                Reject
              </Button>
            </>
          )}
          {canAppeal && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending || !hasText}
              onClick={() =>
                void run(
                  () => appealM.mutateAsync({ id: request.id, text, proof }),
                  {
                    loading: "Submitting appeal...",
                    success: "Appeal submitted.",
                  },
                )
              }
            >
              Appeal
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              className="hover:border-destructive hover:text-destructive"
              onClick={() => setConfirmCancel(true)}
            >
              Cancel Request
            </Button>
          )}
          {noActions && (
            <span className="typo-muted text-sm">
              No actions available for this request.
            </span>
          )}
        </div>
      </div>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel your request. The thread remains visible and can
              still be commented on, but no further status changes are allowed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Request</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setConfirmCancel(false);
                void run(
                  () =>
                    cancelM.mutateAsync({
                      id: request.id,
                      text: text || undefined,
                      proof,
                    }),
                  {
                    loading: "Cancelling request...",
                    success: "Request cancelled.",
                  },
                );
              }}
            >
              Yes, cancel request
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

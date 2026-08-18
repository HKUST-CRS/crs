"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useMemo, useRef, useState } from "react";
import {
  MAX_PROOF_FILES,
  MAX_PROOF_SIZE,
  type ProofFile,
  type ProofFileUpload,
  type Request,
  type RequestStatus,
  type ThreadEntry,
  type User,
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
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
  const status = request.status;
  // The latest status-change entry is the current decision; every earlier
  // status entry is superseded (e.g. rejected-then-approved) and rendered muted.
  let lastStatusIndex = -1;
  for (let i = request.updates.length - 1; i >= 0; i--) {
    if (request.updates[i].kind === "status") {
      lastStatusIndex = i;
      break;
    }
  }
  // Comments are allowed for the requester or an instructor at any point,
  // including after cancellation. Observers have read-only access. Status
  // changes are gated by role and (for re-decision) by the request not being
  // cancelled.
  const canComment = isRequester || isInstructor;
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
        {request.updates.map((entry, i) => (
          <ThreadEntryView
            key={entry.id}
            entry={entry}
            author={authors.get(entry.from)}
            superseded={entry.kind === "status" && i !== lastStatusIndex}
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
  superseded = false,
}: {
  entry: ThreadEntry;
  author?: User;
  superseded?: boolean;
}) {
  const name = author?.name || entry.from;
  const timestamp = formatDateTime(fromISO(entry.timestamp));
  if (entry.kind === "comment") {
    return (
      <div className="rounded-md border p-3">
        <div className="typo-muted text-sm">
          <b>{name}</b> commented · {timestamp}
        </div>
        <p className="mt-1 whitespace-pre-wrap text-sm">{entry.text}</p>
        {entry.proof && entry.proof.length > 0 && (
          <ProofList proof={entry.proof} />
        )}
      </div>
    );
  }
  // status change
  const s = STATUS_STYLE[entry.status];
  if (superseded) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-400">
          {s.label}
        </span>
        <span className="typo-muted">
          by <b>{name}</b> · {timestamp}
        </span>
        <span className="typo-muted text-xs italic">superseded</span>
      </div>
    );
  }
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
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // The bytes live in GridFS, not on the entry, so fetch on click then trigger
  // the browser download.
  const download = async (file: ProofFile) => {
    try {
      const { content } = await queryClient.fetchQuery(
        trpc.request.proofContent.queryOptions({
          attachmentId: file.attachmentId,
        }),
      );
      downloadBase64File(content, file.name);
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  return (
    <ul className="mt-2 flex flex-col gap-1">
      {proof.map((file) => (
        <li key={file.attachmentId}>
          <button
            type="button"
            className="wrap-anywhere max-w-full cursor-pointer text-left text-sm underline"
            onClick={() => void download(file)}
          >
            {file.name}
          </button>
        </li>
      ))}
    </ul>
  );
}

// ── Composer ────────────────────────────────────────────────────────────────

const MAX_PROOF_SIZE_MIB = MAX_PROOF_SIZE / 1024 / 1024;

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
  const [proof, setProof] = useState<ProofFileUpload[] | undefined>(undefined);
  const [readingProof, setReadingProof] = useState(false);
  const [proofKey, setProofKey] = useState(0);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const hasText = text.trim().length > 0;
  const mutationPending =
    commentM.isPending ||
    approveM.isPending ||
    rejectM.isPending ||
    appealM.isPending ||
    cancelM.isPending;
  const busy = mutationPending || readingProof;
  const hasProof = !!proof?.length;
  // A remark is required to attach proof (see StatusActionInput), so block the
  // status actions until text is added instead of letting the server reject.
  const proofNeedsText = hasProof && !hasText;
  const selectionToken = useRef(0);

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
    selectionToken.current++;
    setText("");
    setProof(undefined);
    setReadingProof(false);
    setProofKey((k) => k + 1);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    // Token guards the async conversion: a newer selection invalidates an
    // in-flight one so out-of-order resolution can't overwrite the latest pick.
    const token = ++selectionToken.current;
    setProof(undefined);
    const fileArray = [...files];
    const tooMany = fileArray.length > MAX_PROOF_FILES;
    const oversized = fileArray.find((f) => f.size > MAX_PROOF_SIZE);
    if (tooMany || oversized) {
      // Clear the previously accepted proof and reset the input on failure, so
      // the displayed selection never diverges from what will be submitted.
      setReadingProof(false);
      setProofKey((k) => k + 1);
      toast.error(
        tooMany
          ? `At most ${MAX_PROOF_FILES} files are allowed.`
          : `"${oversized?.name}" exceeds the ${MAX_PROOF_SIZE_MIB} MiB limit.`,
      );
      return;
    }
    setReadingProof(true);
    try {
      const converted = await Promise.all(
        fileArray.map(async (f) => ({
          name: f.name,
          size: f.size,
          content: await readFileAsBase64(f),
        })),
      );
      if (token === selectionToken.current) {
        setProof(converted);
      }
    } catch (e) {
      if (token === selectionToken.current) {
        setProofKey((k) => k + 1);
        toast.error(`Failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    } finally {
      if (token === selectionToken.current) setReadingProof(false);
    }
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
    <section className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="composer-text">Comment</FieldLabel>
        <Textarea
          id="composer-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          disabled={busy}
        />
        {canDecide ? (
          <FieldDescription>
            An optional remark for your decision, or additional information or
            context for your comment.
          </FieldDescription>
        ) : (
          <FieldDescription>
            Please provide any additional information or context.
          </FieldDescription>
        )}
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
          disabled={busy}
        />
        <FieldDescription>
          Please provide up to {MAX_PROOF_FILES} supporting documents for your
          request. The maximum file size is {MAX_PROOF_SIZE_MIB} MiB each.
        </FieldDescription>
      </Field>
      <div className="flex flex-wrap justify-end gap-2">
        {canCancel && (
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || proofNeedsText}
            className="hover:border-destructive hover:text-destructive"
            onClick={() => setConfirmCancel(true)}
          >
            Cancel Request
          </Button>
        )}
        {canDecide && (
          <>
            <Button
              size="sm"
              disabled={busy || proofNeedsText}
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
              disabled={busy || proofNeedsText}
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
            disabled={busy || !hasText}
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
        {canComment && (
          <Button
            size="sm"
            variant="default"
            disabled={busy || !hasText}
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
        {noActions && (
          <span className="typo-muted text-sm">
            No actions are available for this request.
          </span>
        )}
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
              disabled={busy || proofNeedsText}
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

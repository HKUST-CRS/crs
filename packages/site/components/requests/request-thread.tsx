"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useMemo, useRef, useState } from "react";
import {
  MAX_PROOF_FILES,
  MAX_PROOF_SIZE,
  type ProofFile,
  type ProofFileInit,
  ProofUploadAccept,
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
import { REQUEST_STATUS_LABEL } from "./request-status";
import { downloadBase64File, readProofs } from "./utils";

/**
 * `RequestThread` renders the immutable request header (via the viewonly
 * `RequestForm`), the append-only thread (comments + status
 * changes), and a GitHub-style composer: a persistent text box and proofs
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
  const isAppeal = !!request.participants;
  // "Participant" here includes course admins, who can view and decide every
  // appeal in the courses they administer even if they are not a participant.
  const isAdminInCourse =
    !!user &&
    user.enrollment.some(
      (e) =>
        e.role === "admin" &&
        e.course.code === request.class.course.code &&
        e.course.term === request.class.course.term,
    );
  const isParticipant =
    (!!user && !!request.participants?.includes(user.email)) || isAdminInCourse;
  const status = request.status;
  // The latest status-change entry is the current decision; every earlier
  // status entry is superseded (e.g. rejected-then-approved) and rendered muted.
  const lastStatusIndex = request.thread.findLastIndex(
    (entry) => entry.kind === "status",
  );
  // Comments are allowed for the requester or an instructor at any point,
  // including after cancellation. Observers have read-only access. Status
  // changes are gated by role and (for re-decision) by the request not being
  // cancelled. For appeals, every participant may comment and any participant
  // other than the requester may decide; there is no re-appeal of an appeal.
  const canComment = isAppeal ? isParticipant : isRequester || isInstructor;
  const canDecide =
    status !== "cancelled" &&
    (isAppeal
      ? isParticipant && (!isRequester || isAdminInCourse)
      : isInstructor);
  const canCancel = isRequester && status !== "cancelled";
  const canAppeal =
    !isAppeal &&
    isRequester &&
    (status === "approved" || status === "rejected");

  return (
    <div className="flex flex-col gap-6">
      <StatusBanner status={status} />

      {/* Immutable request header */}
      <RequestForm default={request} viewonly />

      {/* Teaching Assistants — shown only for assignment appeals, right under
          the instructor list in the header. */}
      {request.type === "Assignment Appeal" && (
        <AppealTAList request={request} />
      )}

      <hr />

      {/* Thread */}
      <section className="flex flex-col gap-3">
        <h4 className="typo-small">Thread</h4>
        {request.thread.map((entry, i) => (
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

const STATUS_STYLE: Record<RequestStatus, string> = {
  open: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  approved: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
  rejected: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
  appealed: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  cancelled: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
};

function StatusBanner({ status }: { status: RequestStatus }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={clsx(
          "rounded px-2 py-0.5 font-medium text-sm",
          STATUS_STYLE[status],
        )}
      >
        {REQUEST_STATUS_LABEL[status]}
      </span>
    </div>
  );
}

/**
 * The teaching assistants responsible for the appealed assignment, shown
 * under the instructor list on the thread page for assignment appeals.
 */
function AppealTAList({ request }: { request: Request }) {
  const trpc = useTRPC();
  const course = useQuery(
    trpc.course.get.queryOptions(request.class.course),
  ).data;
  const tas =
    request.type === "Assignment Appeal"
      ? (course?.assignments?.[request.metadata.assignment]?.tas ?? [])
      : [];
  const taUsers = useQuery(
    trpc.user.getAllByEmails.queryOptions(tas, {
      enabled: tas.length > 0,
    }),
  ).data;
  // Only render once the course has loaded. A viewer who cannot load the
  // course (e.g. a TA with no course enrollment) gets no section at all rather
  // than a misleading "no teaching assistants assigned" message.
  if (!course || request.type !== "Assignment Appeal") return null;
  return (
    <section className="flex flex-col gap-2">
      <h4 className="typo-small">TA in charge</h4>
      {tas.length === 0 ? (
        <p className="typo-muted text-sm">
          No teaching assistants are assigned to this assignment.
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {tas.map((email) => {
            const user = taUsers?.find((u) => u.email === email);
            return (
              <li key={email} className="text-sm">
                {user?.name ? <b>{user.name}</b> : null}{" "}
                <a
                  href={`mailto:${email}`}
                  className="underline underline-offset-4"
                >
                  {email}
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
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
  const authorLabel = author ? (
    <>
      <b>{author.name}</b>{" "}
      <a
        href={`mailto:${author.email}`}
        className="underline underline-offset-4"
      >
        {`<${author.email}>`}
      </a>
    </>
  ) : (
    <a href={`mailto:${entry.from}`} className="underline underline-offset-4">
      {entry.from}
    </a>
  );
  const timestamp = formatDateTime(fromISO(entry.timestamp));
  if (entry.kind === "comment") {
    return (
      <div className="flex flex-col gap-2 rounded-md border p-3">
        <div className="typo-muted text-sm">
          {authorLabel} commented · {timestamp}
        </div>
        <p className="whitespace-pre-wrap text-sm">{entry.text}</p>
        {entry.proofs && entry.proofs.length > 0 && (
          <ProofList proofs={entry.proofs} />
        )}
      </div>
    );
  }
  // status change
  if (superseded) {
    return (
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-400">
          {REQUEST_STATUS_LABEL[entry.status]}
        </span>
        <span className="typo-muted">
          by {authorLabel} · {timestamp}
        </span>
        <span className="typo-muted text-xs italic">superseded</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={clsx(
          "rounded px-2 py-0.5 font-medium",
          STATUS_STYLE[entry.status],
        )}
      >
        {REQUEST_STATUS_LABEL[entry.status]}
      </span>
      <span className="typo-muted">
        by {authorLabel} · {timestamp}
      </span>
    </div>
  );
}

type Proof = ProofFile | ProofFileInit;

function ProofList({ proofs }: { proofs: Proof[] }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  // The bytes live in GridFS, not on the entry, so fetch on click then trigger
  // the browser download.
  const download = async (file: Proof) => {
    try {
      if ("content" in file) {
        downloadBase64File(file.content, file.name);
        return;
      }
      const { content } = await queryClient.fetchQuery(
        trpc.request.getProof.queryOptions({
          attachmentId: file.id,
        }),
      );
      downloadBase64File(content, file.name);
    } catch (e) {
      toast.error(`Failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  return (
    <ul className="typo-muted">
      {proofs.map((file, i) => (
        <li key={file.name + String(i)}>
          <button
            type="button"
            className="pointer-events-auto cursor-pointer underline"
            onClick={() => void download(file)}
          >
            {file.name}
          </button>{" "}
          ({(file.size / 1024 / 1024).toFixed(2)} MiB)
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
  const [proofs, setProofs] = useState<ProofFileInit[] | undefined>(undefined);
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
  const hasProof = !!proofs?.length;
  // A comment is required to attach proofs, so block the
  // status actions until text is added instead of letting the server reject.
  const proofNeedsText = hasProof && !hasText;
  const selectionToken = useRef(0);

  const clear = () => {
    selectionToken.current++;
    setText("");
    setProofs(undefined);
    setReadingProof(false);
    setProofKey((k) => k + 1);
  };

  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    // Token guards the async conversion: a newer selection invalidates an
    // in-flight one so out-of-order resolution can't overwrite the latest pick.
    const token = ++selectionToken.current;
    setProofs(undefined);
    const fileArray = [...files];
    const tooMany = fileArray.length > MAX_PROOF_FILES;
    const oversized = fileArray.find((f) => f.size > MAX_PROOF_SIZE);
    if (tooMany || oversized) {
      // Clear the previously accepted proofs and reset the input on failure, so
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
      const converted = await readProofs(files);
      if (token === selectionToken.current) {
        setProofs(converted);
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
      await queryClient.invalidateQueries({
        queryKey: trpc.request.pathKey(),
      });
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
            An optional comment for your decision, or additional information or
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
          accept={ProofUploadAccept.join(",")}
          onChange={(e) => void onFiles(e.target.files)}
          disabled={busy}
        />
        <FieldDescription>
          Please provide up to {MAX_PROOF_FILES} supporting documents for your
          request. The maximum file size is {MAX_PROOF_SIZE_MIB} MiB each.
        </FieldDescription>
        {proofs && proofs.length > 0 && <ProofList proofs={proofs} />}
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
                      comment: text.trim()
                        ? { text: text.trim(), proofs }
                        : undefined,
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
                      comment: text.trim()
                        ? { text: text.trim(), proofs }
                        : undefined,
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
                () => appealM.mutateAsync({ id: request.id, text, proofs }),
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
                () => commentM.mutateAsync({ id: request.id, text, proofs }),
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
                      comment: text.trim()
                        ? { text: text.trim(), proofs }
                        : undefined,
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

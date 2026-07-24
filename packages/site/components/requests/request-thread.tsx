"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import clsx from "clsx";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type ProofFile,
  type Request,
  ResponseDecision,
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import { downloadBase64File, readFileAsBase64 } from "./utils";

/**
 * The request body is immutable after creation. `RequestThread` renders that
 * immutable header (via the viewonly `RequestForm`), the append-only thread of
 * updates, and a role/status-aware composer for posting new updates.
 */
export type RequestThreadProps = {
  request: Request;
  onUpdated?: () => void;
};

type ComposerMode = "comment" | "respond" | "cancel" | "appeal" | null;

export default function RequestThread({
  request,
  onUpdated = () => {},
}: RequestThreadProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Resolve author names for everyone who may appear in the thread. We use the
  // class-scoped roster endpoints (instructors + observers) rather than per-user
  // `user.get`, because a student viewing the thread is not permitted to fetch
  // arbitrary instructor/observer users by id — the roster endpoints are
  // allowed for any class member. The requester and the viewer are covered by
  // `getCurrent` (the viewer is usually the requester when viewing as a
  // student) and by the rosters when they are staff.
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
  const isStaff =
    !!user &&
    user.enrollment.some(
      (e) =>
        e.course.code === request.class.course.code &&
        e.course.term === request.class.course.term &&
        (e.section === request.class.section || e.section === "*") &&
        (e.role === "instructor" || e.role === "observer"),
    );
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
  const canComment = (isRequester || isStaff) && status !== "cancelled";
  const canRespond = isInstructor && status === "open";
  const canCancel = isRequester && status === "open";
  const canAppeal = isRequester && status === "resolved";

  const [mode, setMode] = useState<ComposerMode>(null);
  const composerRef = useRef<HTMLDivElement>(null);

  // The Actions bar sits at the bottom of the page, so the composer revealed by
  // a button click renders *below the fold*. Without scrolling, the form is
  // invisible and the action looks like it did nothing. Bring the freshly
  // revealed composer into view whenever the active mode changes.
  useEffect(() => {
    if (!mode) return;
    // Wait a frame so the conditionally-rendered form has laid out.
    const id = requestAnimationFrame(() => {
      composerRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(id);
  }, [mode]);

  // After a thread action lands, invalidate the request query so the thread
  // refreshes in place — reliably. The mutations return no data, so the UI
  // depends on this re-fetch to reflect the new entry / status. Awaiting it
  // before closing the composer avoids the occasional flaky refresh.
  const handleDone = async () => {
    await queryClient.invalidateQueries({
      queryKey: trpc.request.get.queryKey(request.id),
    });
    onUpdated();
    setMode(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <StatusBanner status={status} response={request.response} />

      {/* Immutable request header */}
      <RequestForm default={request} viewonly />

      <hr />

      {/* Thread */}
      <section className="flex flex-col gap-3">
        <h4 className="font-medium text-sm">Thread</h4>
        <ThreadRow
          who="created"
          author={authors.get(request.from)}
          email={request.from}
          timestamp={request.timestamp}
        >
          <span className="typo-muted">Request submitted.</span>
        </ThreadRow>
        {request.updates.map((entry) => (
          <ThreadEntryView
            key={entry.id}
            entry={entry}
            author={authors.get(entry.from)}
          />
        ))}
      </section>

      <hr />

      {/* Composer */}
      <section className="flex flex-col gap-3">
        <h4 className="font-medium text-sm">Actions</h4>
        <div className="flex flex-wrap gap-2">
          {canComment && (
            <Button
              variant={mode === "comment" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode(mode === "comment" ? null : "comment")}
            >
              Add Comment
            </Button>
          )}
          {canRespond && (
            <Button
              variant={mode === "respond" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode(mode === "respond" ? null : "respond")}
            >
              Respond
            </Button>
          )}
          {canCancel && (
            <Button
              variant={mode === "cancel" ? "destructive" : "outline"}
              size="sm"
              className={
                mode === "cancel"
                  ? undefined
                  : "hover:border-destructive hover:text-destructive"
              }
              onClick={() => setMode(mode === "cancel" ? null : "cancel")}
            >
              Cancel Request
            </Button>
          )}
          {canAppeal && (
            <Button
              variant={mode === "appeal" ? "default" : "outline"}
              size="sm"
              onClick={() => setMode(mode === "appeal" ? null : "appeal")}
            >
              Appeal
            </Button>
          )}
          {!canComment && !canRespond && !canCancel && !canAppeal && (
            <span className="typo-muted text-sm">
              No actions available for this request.
            </span>
          )}
        </div>

        <div ref={composerRef} className="flex flex-col gap-3">
          {mode === "comment" && (
            <CommentForm request={request} onDone={handleDone} />
          )}
          {mode === "respond" && (
            <RespondForm request={request} onDone={handleDone} />
          )}
          {mode === "cancel" && (
            <CancelForm request={request} onDone={handleDone} />
          )}
          {mode === "appeal" && (
            <AppealForm request={request} onDone={handleDone} />
          )}
        </div>
      </section>
    </div>
  );
}

function StatusBanner({
  status,
  response,
}: {
  status: Request["status"];
  response: Request["response"];
}) {
  const map = {
    open: {
      label: "Pending",
      className: "text-yellow-800 dark:text-yellow-400",
    },
    resolved: {
      label: response?.decision === "Approve" ? "Approved" : "Rejected",
      className:
        response?.decision === "Approve"
          ? "text-green-800 dark:text-green-400"
          : "text-red-800 dark:text-red-400",
    },
    cancelled: {
      label: "Cancelled",
      className: "text-gray-500",
    },
  } as const;
  const s = map[status];
  return (
    <div className={clsx("font-medium text-sm", s.className)}>
      Status: {s.label}
    </div>
  );
}

function ThreadRow({
  who,
  author,
  email,
  timestamp,
  children,
}: {
  who: string;
  author?: User;
  email: string;
  timestamp: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-md border p-3">
      <div className="typo-muted flex items-center justify-between text-xs">
        <span>
          {author?.name || email} · {who}
        </span>
        <span>{formatDateTime(fromISO(timestamp))}</span>
      </div>
      <div className="mt-1 text-sm">{children}</div>
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
  const who = {
    comment: "commented",
    response: "responded",
    cancel: "cancelled",
    appeal: "appealed",
  }[entry.kind];
  return (
    <ThreadRow
      who={who}
      author={author}
      email={entry.from}
      timestamp={entry.timestamp}
    >
      {entry.kind === "comment" && (
        <>
          <p>{entry.text}</p>
          {entry.proof && entry.proof.length > 0 && (
            <ProofList proof={entry.proof} />
          )}
        </>
      )}
      {entry.kind === "response" && (
        <>
          <p>
            Decision:{" "}
            <b
              className={
                entry.decision === "Approve"
                  ? "text-green-800 dark:text-green-400"
                  : "text-red-800 dark:text-red-400"
              }
            >
              {entry.decision}
            </b>
          </p>
          {entry.remarks && <p className="typo-muted">{entry.remarks}</p>}
        </>
      )}
      {entry.kind === "cancel" && (
        <p>{entry.text ? entry.text : "The request was cancelled."}</p>
      )}
      {entry.kind === "appeal" && (
        <>
          <p>{entry.text}</p>
          {entry.proof && entry.proof.length > 0 && (
            <ProofList proof={entry.proof} />
          )}
        </>
      )}
    </ThreadRow>
  );
}

function ProofList({ proof }: { proof: ProofFile[] }) {
  return (
    <ul className="typo-muted mt-1 text-xs">
      {proof.map((f, i) => (
        <li key={f.name + String(i)}>
          <button
            type="button"
            className="cursor-pointer underline"
            onClick={() => downloadBase64File(f.content, f.name)}
          >
            {f.name}
          </button>{" "}
          ({(f.size / 1024 / 1024).toFixed(2)} MiB)
        </li>
      ))}
    </ul>
  );
}

// ── Composer forms ──────────────────────────────────────────────────────

const MAX_PROOF_FILES = 4;
const MAX_PROOF_FILE_SIZE = 2 * 1024 * 1024; // 2 MiB — matches the backend Proof schema

function useProofState() {
  // NOTE: Each composer (Comment/Appeal) owns its own `useProofState` and is
  // mounted/unmounted by the single `mode` switch in `RequestThread`. Switching
  // modes or submitting unmounts the form, discarding any selected files — so a
  // previously picked proof can never leak into a later, unrelated submission.
  // If the forms are ever lifted out of this mount/unmount lifecycle, this
  // hook must reset `proof` explicitly on submit/mode-change.
  const [proof, setProof] = useState<ProofFile[] | undefined>(undefined);
  const onFiles = async (files: FileList | null) => {
    if (!files) return;
    const fileArray = [...files];
    // Validate eagerly so the user gets immediate feedback instead of a
    // round-trip rejection from the backend Zod schema.
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
  return { proof, onFiles };
}

function CommentForm({
  request,
  onDone,
}: {
  request: Request;
  onDone: () => Promise<void> | void;
}) {
  const trpc = useTRPC();
  const mutation = useMutation(trpc.request.comment.mutationOptions());
  const [text, setText] = useState("");
  const { proof, onFiles } = useProofState();

  const submit = async () => {
    if (!text.trim()) return;
    await toast.promise(mutation.mutateAsync({ id: request.id, text, proof }), {
      loading: "Posting comment...",
      success: "Comment posted.",
      error: (e) => `Failed: ${e?.message ?? String(e)}`,
    });
    await onDone();
  };

  return (
    <ComposerShell
      disabled={mutation.isPending || !text.trim()}
      onSubmit={submit}
    >
      <Field>
        <FieldLabel htmlFor="composer-comment">Comment</FieldLabel>
        <Textarea
          id="composer-comment"
          placeholder="Add a comment / supplementary information"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <ProofInput onFiles={onFiles} />
    </ComposerShell>
  );
}

function AppealForm({
  request,
  onDone,
}: {
  request: Request;
  onDone: () => Promise<void> | void;
}) {
  const trpc = useTRPC();
  const mutation = useMutation(trpc.request.appeal.mutationOptions());
  const [text, setText] = useState("");
  const { proof, onFiles } = useProofState();

  const submit = async () => {
    if (!text.trim()) return;
    await toast.promise(mutation.mutateAsync({ id: request.id, text, proof }), {
      loading: "Submitting appeal...",
      success: "Appeal submitted. The request has been reopened.",
      error: (e) => `Failed: ${e?.message ?? String(e)}`,
    });
    await onDone();
  };

  return (
    <ComposerShell
      disabled={mutation.isPending || !text.trim()}
      onSubmit={submit}
    >
      <Field>
        <FieldLabel htmlFor="composer-appeal">Appeal</FieldLabel>
        <Textarea
          id="composer-appeal"
          placeholder="Justification for the appeal"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <ProofInput onFiles={onFiles} />
    </ComposerShell>
  );
}

function CancelForm({
  request,
  onDone,
}: {
  request: Request;
  onDone: () => Promise<void> | void;
}) {
  const trpc = useTRPC();
  const mutation = useMutation(trpc.request.cancel.mutationOptions());
  const [text, setText] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const submit = async () => {
    await toast.promise(
      mutation.mutateAsync({ id: request.id, text: text || undefined }),
      {
        loading: "Cancelling request...",
        success: "Request cancelled.",
        error: (e) => `Failed: ${e?.message ?? String(e)}`,
      },
    );
    await onDone();
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <Field>
        <FieldLabel htmlFor="composer-cancel">Reason (optional)</FieldLabel>
        <Textarea
          id="composer-cancel"
          placeholder="Optional reason for cancellation"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </Field>
      <div className="flex justify-end">
        <Button
          variant="destructive"
          size="sm"
          onClick={() => setConfirmOpen(true)}
        >
          Cancel
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this request?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently cancel your request. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Request</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={mutation.isPending}
              onClick={() => {
                setConfirmOpen(false);
                void submit();
              }}
            >
              Yes, cancel request
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RespondForm({
  request,
  onDone,
}: {
  request: Request;
  onDone: () => Promise<void> | void;
}) {
  const trpc = useTRPC();
  const mutation = useMutation(trpc.request.respond.mutationOptions());
  const [remarks, setRemarks] = useState("");
  const [decision, setDecision] = useState<ResponseDecision | "">("");

  const submit = async () => {
    if (!decision) return;
    await toast.promise(
      mutation.mutateAsync({
        id: request.id,
        remarks,
        decision: decision as ResponseDecision,
      }),
      {
        loading: "Submitting response...",
        success: "Response submitted.",
        error: (e) => `Failed: ${e?.message ?? String(e)}`,
      },
    );
    await onDone();
  };

  return (
    <ComposerShell disabled={mutation.isPending || !decision} onSubmit={submit}>
      <Field>
        <FieldLabel htmlFor="respond-remarks">Remarks</FieldLabel>
        <Textarea
          id="respond-remarks"
          placeholder="Remarks regarding the decision"
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor="respond-decision">Decision</FieldLabel>
        <Select
          value={decision}
          onValueChange={(v) => setDecision(v as ResponseDecision)}
        >
          <SelectTrigger id="respond-decision" className="w-full">
            <SelectValue placeholder="Decision" />
          </SelectTrigger>
          <SelectContent>
            {[...ResponseDecision.values].map((v) => (
              <SelectItem key={v} value={v}>
                <b
                  className={
                    v === "Approve"
                      ? "text-green-800 dark:text-green-400"
                      : "text-red-800 dark:text-red-400"
                  }
                >
                  {v}
                </b>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </ComposerShell>
  );
}

function ComposerShell({
  disabled,
  onSubmit,
  children,
}: {
  disabled: boolean;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <form
      className="flex flex-col gap-2 rounded-md border p-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) void onSubmit();
      }}
    >
      {children}
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={disabled}>
          Submit
        </Button>
      </div>
    </form>
  );
}

function ProofInput({
  onFiles,
}: {
  onFiles: (files: FileList | null) => void;
}) {
  return (
    <Field>
      <FieldLabel htmlFor="composer-proof">Supporting documents</FieldLabel>
      <Input
        id="composer-proof"
        type="file"
        multiple
        accept="image/*,application/pdf,text/plain"
        onChange={(e) => void onFiles(e.target.files)}
      />
    </Field>
  );
}

import z from "zod";
import { UserID } from "../user";
import { ProofList, ProofListInit } from "./Proof";
import { RequestStatus } from "./RequestStatus";

/**
 * The unique identifier for a thread entry.
 *
 * In the current implementation, this is an automatically generated MongoDB
 * ObjectID, allocated by the repo when the entry is appended.
 */
export const ThreadEntryID = z.string();
export type ThreadEntryID = z.infer<typeof ThreadEntryID>;

export const ThreadEntryBase = z.object({
  id: ThreadEntryID,
  from: UserID,
  timestamp: z.iso.datetime({ offset: true }),
});
export type ThreadEntryBase = z.infer<typeof ThreadEntryBase>;

/** A comment supplied before the server assigns thread fields. */
export const CommentInit = z.object({
  text: z.string().nonempty("A comment cannot be empty."),
  proofs: ProofListInit,
});
export type CommentInit = z.infer<typeof CommentInit>;

/**
 * The monomorphic content entry of the thread: a message, optionally with
 * supporting documents, posted by the requester or an instructor. The request's
 * opening reason + proofs are recorded as the first comment at creation time, so
 * every piece of textual/attachment content on a request lives in one place.
 */
export const Comment = ThreadEntryBase.extend({
  kind: z.literal("comment"),
  text: z.string().nonempty("A comment cannot be empty."),
  proofs: ProofList,
});
export type Comment = z.infer<typeof Comment>;

export function makeComment(
  base: ThreadEntryBase,
  text: string,
  proofs?: ProofList,
): Comment {
  return {
    ...base,
    kind: "comment",
    text,
    ...(proofs ? { proofs } : {}),
  };
}

/** A status change supplied before the server assigns thread fields. */
export const StatusChangeInit = z.object({
  status: RequestStatus,
});
export type StatusChangeInit = z.infer<typeof StatusChangeInit>;

/**
 * A change of the request's lifecycle status. Carries only the new status; any
 * text accompanying the change is recorded as a preceding comment entry (so
 * content stays monomorphic). Status changes are append-only: the request's
 * `status` always reflects the latest status-change entry.
 */
export const StatusChange = ThreadEntryBase.extend({
  kind: z.literal("status"),
  status: RequestStatus,
});
export type StatusChange = z.infer<typeof StatusChange>;

export function makeStatusChange(
  base: ThreadEntryBase,
  init: StatusChangeInit,
): StatusChange {
  return { ...base, kind: "status", ...init };
}

/**
 * An entry in the append-only thread of a request.
 */
export const ThreadEntry = z.discriminatedUnion("kind", [
  Comment,
  StatusChange,
]);
export type ThreadEntry = z.infer<typeof ThreadEntry>;

export function statusFromThread(thread: ThreadEntry[]): RequestStatus {
  return (
    thread.findLast((entry): entry is StatusChange => entry.kind === "status")
      ?.status ?? "open"
  );
}

import z from "zod";
import { UserID } from "../user";
import { Proof } from "./Proof";
import { RequestStatus } from "./RequestStatus";

/**
 * The unique identifier for a thread entry.
 *
 * In the current implementation, this is an automatically generated MongoDB
 * ObjectID, allocated by the repo when the entry is appended.
 */
export const ThreadEntryID = z.string();
export type ThreadEntryID = z.infer<typeof ThreadEntryID>;

const ThreadEntryBase = z.object({
  id: ThreadEntryID,
  from: UserID,
  timestamp: z.iso.datetime({ offset: true }),
});

/**
 * The monomorphic content entry of the thread: a message, optionally with
 * supporting documents, posted by the requester or an instructor. The request's
 * opening reason + proof is recorded as the first comment at creation time, so
 * every piece of textual/attachment content on a request lives in one place.
 */
export const CommentEntry = ThreadEntryBase.extend({
  kind: z.literal("comment"),
  text: z.string().nonempty("A comment cannot be empty."),
  proof: Proof,
});
export type CommentEntry = z.infer<typeof CommentEntry>;

/**
 * A change of the request's lifecycle status. Carries only the new status; any
 * remark accompanying the change is recorded as a preceding comment entry (so
 * content stays monomorphic). Status changes are append-only: the request's
 * denormalized `status` always reflects the latest status-change entry.
 */
export const StatusChangeEntry = ThreadEntryBase.extend({
  kind: z.literal("status"),
  status: RequestStatus,
});
export type StatusChangeEntry = z.infer<typeof StatusChangeEntry>;

/**
 * An entry in the append-only thread of a request.
 */
export const ThreadEntry = z.discriminatedUnion("kind", [
  CommentEntry,
  StatusChangeEntry,
]);
export type ThreadEntry = z.infer<typeof ThreadEntry>;

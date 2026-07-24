import z from "zod";
import { UserID } from "../user";
import { Proof } from "./Proof";
import { ResponseDecision } from "./Response";

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
 * A supplementary message, optionally with supporting documents, posted by the
 * student or an instructor/observer to provide more information. The request
 * body is never edited; clarification is given via comments.
 */
export const CommentEntry = ThreadEntryBase.extend({
  kind: z.literal("comment"),
  text: z.string().nonempty("A comment cannot be empty."),
  proof: Proof,
});
export type CommentEntry = z.infer<typeof CommentEntry>;

/**
 * An instructor's decision on the request. Allowed multiple times across an
 * appeal cycle; the top-level denormalized `response` field always reflects the
 * latest response entry.
 */
export const ResponseEntry = ThreadEntryBase.extend({
  kind: z.literal("response"),
  remarks: z.string(),
  decision: ResponseDecision,
});
export type ResponseEntry = z.infer<typeof ResponseEntry>;

/**
 * The student's cancellation of the request. Terminal: a cancelled request
 * cannot be responded to or appealed.
 */
export const CancelEntry = ThreadEntryBase.extend({
  kind: z.literal("cancel"),
  text: z.string().optional(),
});
export type CancelEntry = z.infer<typeof CancelEntry>;

/**
 * The student's appeal of a resolved request, reopening it for another
 * response. Optionally includes a justification and supporting documents.
 */
export const AppealEntry = ThreadEntryBase.extend({
  kind: z.literal("appeal"),
  text: z.string().nonempty("An appeal must include a justification."),
  proof: Proof,
});
export type AppealEntry = z.infer<typeof AppealEntry>;

/**
 * An entry in the append-only thread of a request. The request body is
 * immutable after creation; all follow-up activity is recorded here.
 */
export const ThreadEntry = z.discriminatedUnion("kind", [
  CommentEntry,
  ResponseEntry,
  CancelEntry,
  AppealEntry,
]);
export type ThreadEntry = z.infer<typeof ThreadEntry>;

import { z } from "zod";
import { Class } from "../course";
import { UserID } from "../user";
import { Proof } from "./Proof";
import { RequestStatus } from "./RequestStatus";
import type { RequestType } from "./RequestType";
import { ThreadEntry } from "./Thread";

export const RequestDetails = z.object({
  reason: z
    .string()
    .nonempty("A brief explanation for the request is required.")
    .meta({ description: "A brief explanation of the request." }),
  proof: Proof.meta({
    description: "Optional supporting documents or files for the request.",
  }),
});
export type RequestDetails = z.infer<typeof RequestDetails>;

export const RequestDetailsProofAccept = [
  "image/*",
  "application/pdf",
  "text/plain",
];

export const RequestID = z.string().meta({
  description:
    "The unique identifier for the request. " +
    "In the current implementation, this is the automatically generated MongoDB ObjectID.",
});
export type RequestID = z.infer<typeof RequestID>;

export const BaseRequest = z.object({
  id: RequestID,
  from: UserID,
  class: Class,
  timestamp: z.iso.datetime({ offset: true }),
  /**
   * The current lifecycle status of the request.
   *
   * Denormalized from the thread: set to the status of the latest status-change
   * entry (and "open" at creation). Status changes are append-only, so this is
   * always the latest status event.
   */
  status: RequestStatus,
  /**
   * The append-only thread of updates to the request. The request body itself
   * (class, type, metadata) is immutable after creation; all content (the
   * opening reason + proof, follow-up comments) and every status change are
   * recorded here.
   */
  updates: z.array(ThreadEntry),
});
export type BaseRequest = z.infer<typeof BaseRequest>;

/**
 * A constructor function to create specific request types with associated metadata.
 * @param type The type of the request.
 * @param metadata The metadata schema specific to the request type.
 * @returns A Zod schema representing the complete request structure.
 */
export const createRequestType = <T extends RequestType, O, I>(
  type: T,
  metadata: z.ZodType<O, I>,
) => {
  return BaseRequest.extend({
    type: z.literal(type),
    metadata: metadata,
  });
};

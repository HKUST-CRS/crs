import { z } from "zod";
import { Class } from "../course";
import { UserID } from "../user";
import { RequestStatus } from "./RequestStatus";
import type { RequestType } from "./RequestType";
import { ThreadEntry } from "./Thread";

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
   * The current lifecycle status of the request. Derived from the latest
   * status-change entry in the thread, or "open" when there is none.
   */
  status: RequestStatus,
  /**
   * An append-only thread for the request. The request body itself is
   * immutable after creation; all new info and status changes are
   * recorded here.
   */
  thread: z.array(ThreadEntry),
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

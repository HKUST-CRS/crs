import z from "zod";

/**
 * The lifecycle status of a request.
 *
 * - "open": awaiting an instructor decision.
 * - "approved" / "rejected": an instructor has decided. An instructor may decide
 *   again, so these are not terminal.
 * - "appealed": the requester has asked for the decision to be reconsidered;
 *   surfaces these requests in the instructor queue.
 * - "cancelled": the requester has withdrawn the request. Terminal for status
 *   changes, but comments may still be added.
 *
 * Derived from the append-only thread; see `Request.status`.
 */
export const RequestStatus = z.enum([
  "open",
  "approved",
  "rejected",
  "appealed",
  "cancelled",
]);
export type RequestStatus = z.infer<typeof RequestStatus>;

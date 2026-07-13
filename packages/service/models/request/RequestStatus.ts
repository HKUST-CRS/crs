import z from "zod";

/**
 * The lifecycle status of a request.
 *
 * - "open": the request is awaiting a response, or has been reopened by an appeal.
 * - "resolved": an instructor has responded (approved or rejected).
 * - "cancelled": the student has cancelled the request (terminal).
 *
 * Denormalized from the append-only thread; see `BaseRequest.status`.
 */
export const RequestStatus = z.enum(["open", "cancelled", "resolved"]);
export type RequestStatus = z.infer<typeof RequestStatus>;

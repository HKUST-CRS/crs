import { z } from "zod";
import { CourseId } from "../course";
import { UserId } from "../user";
import type { RequestType } from "./type";

export const RequestDetails = z.object({
  reason: z
    .string()
    .meta({ description: "A brief explanation of the request." }),
  proof: z
    .array(
      z
        .file()
        .max(2 * 1024 * 1024)
        .mime(["image/*", "application/pdf", "text/plain"]),
    )
    .meta({
      description: "Optional supporting documents or files for the request.",
    }),
});
export type RequestDetails = z.infer<typeof RequestDetails>;

export const RequestDetailsProofAccept =
  RequestDetails.shape.proof.def.element._zod.bag.mime ?? [];

export const ResponseDecision = z.literal(["Approve", "Reject"]);
export type ResponseDecision = z.infer<typeof ResponseDecision>;

export const Response = z.object({
  from: UserId,
  timestamp: z.iso.datetime(),
  remarks: z.string(),
  decision: ResponseDecision,
});
export type Response = z.infer<typeof Response>;

export const BaseRequest = z.object({
  id: z.string(),
  from: UserId,
  course: CourseId,
  details: RequestDetails,
  timestamp: z.iso.datetime(),
  response: z.union([Response, z.null()]),
});

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

import { z } from "zod";
import { Class } from "../course";
import { UserID } from "../user";
import type { RequestType } from "./RequestType";
import { Response } from "./Response";

export const RequestDetails = z.object({
  reason: z
    .string()
    .nonempty("A brief explanation for the request is required.")
    .meta({ description: "A brief explanation of the request." }),
  proof: z
    .array(
      z.object({
        name: z.string().meta({ description: "The name of the file." }),
        size: z
          .number()
          .meta({ description: "The size of the file in bytes." })
          .max(2 * 1024 * 1024, "At most 2 MiB per file is allowed."),
        content: z.base64().meta({
          description: "The base64-encoded content of the file. ",
        }),
      }),
    )
    .max(4, "At most 4 supporting documents are allowed.")
    .optional()
    .meta({
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
  details: RequestDetails,
  timestamp: z.iso.datetime({ offset: true }),
  response: z.union([Response, z.null()]),
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

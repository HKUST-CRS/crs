import { z } from "zod";
import { UserId, CourseId, FileReference } from "../util.js";
import { ALL_REQUEST_TYPES, type RequestTypeValue } from "./types.js";

export const RequestType = z.enum(
  ALL_REQUEST_TYPES as [RequestTypeValue, ...RequestTypeValue[]]
);
export type RequestType = z.infer<typeof RequestType>;

export const RequestDetails = z.object({
  reason: z.string(),
  proof: z.array(FileReference),
});

export const Response = z.object({
  instructorId: UserId,
  timestamp: z.iso.datetime(),
  approved: z.boolean(),
  remark: z.string(),
});

export const BaseRequest = z.object({
  type: RequestType,
  studentId: UserId,
  courseId: CourseId,
  timestamp: z.iso.datetime(),
  metadata: z.object(),
  details: RequestDetails,
  response: z.union([Response, z.null()]),
});

/**
 * Helper function to create request constructors
 */
export const createRequestConstructor = (
  type: RequestTypeValue,
  metadata: z.ZodTypeAny
) => {
  return BaseRequest.extend({
    type: z.literal(type),
    metadata: metadata,
  });
};

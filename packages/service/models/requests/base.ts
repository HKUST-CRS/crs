import { z } from "zod";
import { User } from "../user";
import { Course } from "../course";

export const RequestType = z.enum(["Swap Section", "Deadline Extension"]);
export type RequestType = z.infer<typeof RequestType>;

export const RequestDetails = z.object({
  reason: z.string(),
  proof: z.array(z.file().max(5 * 1024 * 1024)),
});

export const Response = z.object({
  instructorEmail: User.shape.email,
  timestamp: z.iso.datetime(),
  approved: z.boolean(),
  remark: z.string(),
});

const BaseRequest = z.object({
  type: RequestType,
  studentEmail: User.shape.email,
  courseCode: Course.shape.code,
  courseSemester: Course.shape.semester,
  timestamp: z.iso.datetime(),
  metadata: z.object(),
  details: RequestDetails,
  response: z.union([Response, z.null()]),
});

/**
 * Helper function to create request type
 */
export const createRequestType = (
  type: RequestType,
  metadata: z.ZodTypeAny
) => {
  return BaseRequest.extend({
    type: type,
    metadata: metadata,
  });
};

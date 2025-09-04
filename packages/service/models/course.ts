import { z } from "zod";
import { UserId, CourseId, RequestId, RequestType } from "./util";

export const Course = z.object({
  _id: CourseId,
  title: z.string(),
  studentIds: z.array(UserId),
  instructorIds: z.array(UserId),
  taIds: z.array(UserId),
  requestIds: z.array(RequestId),
  requestTypesEnabled: z
    .array(RequestType)
    .refine((items) => new Set(items).size === items.length, {
      message: "requestTypesEnabled must have unique items",
    }),
});

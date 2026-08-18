import { CommentInit, type RequestType } from "service/models";
import z from "zod";

export const FormSchema = <T extends RequestType, S extends z.ZodRawShape>(
  type: T,
  meta: z.ZodObject<S>,
) => {
  return z.object({
    type: z.literal(type),
    comment: CommentInit,
    meta: meta,
  });
};

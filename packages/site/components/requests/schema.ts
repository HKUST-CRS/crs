import { RequestDetails } from "service/models";
import z from "zod";

export const FormSchema = <S extends z.ZodRawShape>(meta: z.ZodObject<S>) => {
  return z.object({
    details: RequestDetails,
    ...meta.shape,
  });
};

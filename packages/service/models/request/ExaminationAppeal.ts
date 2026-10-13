import { z } from "zod";
import { createRequestType } from "./BaseRequest";

/** One question per request, with its reason and proofs in the opening comment. */
export const ExaminationAppealMeta = z.strictObject({
  examCode: z.string().trim().min(1),
  question: z.string().trim().min(1),
});
export type ExaminationAppealMeta = z.infer<typeof ExaminationAppealMeta>;

export const ExaminationAppealRequest = createRequestType(
  "Examination Appeal",
  ExaminationAppealMeta,
).meta({
  title: "Examination Appeal",
  description: "Request a grading review for an examination question.",
});
export type ExaminationAppealRequest = z.infer<typeof ExaminationAppealRequest>;

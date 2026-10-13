import { z } from "zod";
import { createRequestType } from "./BaseRequest";

/** One question per request, with its reason and proofs in the opening comment. */
export const ExamAppealMeta = z.strictObject({
  examCode: z.string().trim().min(1),
  question: z.string().trim().min(1),
});
export type ExamAppealMeta = z.infer<typeof ExamAppealMeta>;

export const ExamAppealRequest = createRequestType(
  "Exam Appeal",
  ExamAppealMeta,
).meta({
  title: "Exam Appeal",
  description: "Request a grading review for an exam question.",
});
export type ExamAppealRequest = z.infer<typeof ExamAppealRequest>;

import { z } from "zod";
import { createRequestType } from "./BaseRequest";

/** The exam identifies the request; arrangement details belong in its thread. */
export const ExamSpecialArrangementMeta = z.strictObject({
  examCode: z.string().trim().min(1),
});
export type ExamSpecialArrangementMeta = z.infer<
  typeof ExamSpecialArrangementMeta
>;

export const ExamSpecialArrangementRequest = createRequestType(
  "Exam Special Arrangement",
  ExamSpecialArrangementMeta,
).meta({
  title: "Exam Special Arrangement",
  description:
    "Request a special arrangement for an exam, such as a makeup or absence. Explain the arrangement in the thread.",
});
export type ExamSpecialArrangementRequest = z.infer<
  typeof ExamSpecialArrangementRequest
>;

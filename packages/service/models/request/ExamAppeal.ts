import { z } from "zod";
import type { Course } from "../course";
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

export function validateExamAppeal(
  course: Course,
  metadata: ExamAppealMeta,
): boolean {
  if (!Object.hasOwn(course.exams, metadata.examCode)) return false;
  const questions = course.exams[metadata.examCode]?.questions;
  return !!questions && Object.hasOwn(questions, metadata.question);
}

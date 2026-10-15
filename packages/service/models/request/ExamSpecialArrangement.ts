import { z } from "zod";
import type { Course } from "../course";
import { createRequestType } from "./BaseRequest";

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
    "Request a special arrangement for an exam, such as a makeup or absence.",
});
export type ExamSpecialArrangementRequest = z.infer<
  typeof ExamSpecialArrangementRequest
>;

export function validateExamSpecialArrangement(
  course: Course,
  metadata: ExamSpecialArrangementMeta,
): boolean {
  return Object.hasOwn(course.exams, metadata.examCode);
}

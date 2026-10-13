import { z } from "zod";
import { Class } from "../course";
import { createRequestType } from "./BaseRequest";
import { CommentInit } from "./Thread";

/** One question per request, with its reason and proofs in the opening comment. */
export const ExaminationAppealMeta = z.strictObject({
  examCode: z.string().trim().min(1),
  questionNumber: z.string().trim().min(1),
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

/** A single submit creates all question requests atomically, or creates none. */
export const ExaminationAppealBatch = z.strictObject({
  submissionId: z.uuid(),
  class: Class,
  appeals: z
    .array(
      ExaminationAppealMeta.extend({
        comment: CommentInit.extend({
          text: z.string().trim().min(1, "An appeal reason cannot be empty."),
        }).strict(),
      }),
    )
    .min(1)
    .max(50)
    .refine(
      (appeals) =>
        new Set(
          appeals.map(({ examCode, questionNumber }) =>
            JSON.stringify([examCode, questionNumber]),
          ),
        ).size === appeals.length,
      "A question may only appear once in a submission.",
    ),
});
export type ExaminationAppealBatch = z.infer<typeof ExaminationAppealBatch>;

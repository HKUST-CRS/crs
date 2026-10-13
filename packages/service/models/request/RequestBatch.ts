import { z } from "zod";
import { RequestInit } from "./Request";
import { CommentInit } from "./Thread";

/** Any request types can be submitted together, atomically and with a retry key. */
export const RequestBatch = z.strictObject({
  submissionId: z.uuid(),
  requests: z
    .array(
      z.strictObject({
        request: RequestInit,
        comment: CommentInit.extend({
          text: z.string().trim().min(1, "A request reason cannot be empty."),
        }).strict(),
      }),
    )
    .min(1)
    // Bound the work in one transaction; this is not an exam question limit.
    .max(50)
    .refine((entries) => {
      const targets = entries.flatMap(({ request }) =>
        request.type === "Exam Appeal"
          ? [
              JSON.stringify([
                request.class.course.code,
                request.class.course.term,
                request.class.section,
                request.metadata.examCode,
                request.metadata.question,
              ]),
            ]
          : [],
      );
      return new Set(targets).size === targets.length;
    }, "A question may only appear once per class in a submission."),
});
export type RequestBatch = z.infer<typeof RequestBatch>;

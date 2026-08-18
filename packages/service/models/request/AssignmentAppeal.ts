import { z } from "zod";
import { createRequestType } from "./BaseRequest";

export const AssignmentAppealMeta = z.object({
  assignment: z.string().meta({
    description: "The assignment code whose grade is being appealed.",
  }),
});
export type AssignmentAppealMeta = z.infer<typeof AssignmentAppealMeta>;

/**
 * A request by a student to have an assignment grade re-examined. The reason
 * and any supporting documents are recorded as the opening comment in the
 * thread, exactly like every other request type; only the graded assignment
 * is stored in the metadata. The request is visible only to its participants
 * (the student, the lecturer(s) of the request's section, and the TA(s) of
 * the assignment), which are resolved server-side at creation.
 */
export const AssignmentAppealRequest = createRequestType(
  "Assignment Appeal",
  AssignmentAppealMeta,
).meta({
  title: "Assignment Appeal",
  description: "Request for re-examination of an assignment grade",
});
export type AssignmentAppealRequest = z.infer<typeof AssignmentAppealRequest>;

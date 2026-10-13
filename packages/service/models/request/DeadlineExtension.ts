import { Duration } from "luxon";
import { z } from "zod";
import { fromISO } from "../../utils/datetime";
import type { Course } from "../course";
import { createRequestType } from "./BaseRequest";

export const DeadlineExtensionMeta = z.object({
  assignment: z.string().meta({
    description:
      "The assignment code of the assignment to extend the deadline for. ",
  }),
  deadline: z.iso
    .datetime({ offset: true })
    .meta({ description: "The new deadline for the assignment." }),
});
export type DeadlineExtensionMeta = z.infer<typeof DeadlineExtensionMeta>;

export const DeadlineExtensionRequest = createRequestType(
  "Deadline Extension",
  DeadlineExtensionMeta,
).meta({
  title: "Deadline Extension",
  description: "Request for extension of assignment deadlines",
});
export type DeadlineExtensionRequest = z.infer<typeof DeadlineExtensionRequest>;

export function validateDeadlineExtension(
  course: Course,
  metadata: DeadlineExtensionMeta,
): boolean {
  const assignment = course.assignments[metadata.assignment];
  if (!assignment) return false;

  const due = fromISO(assignment.due);
  const maxExtension = Duration.fromISO(assignment.maxExtension);
  const deadline = fromISO(metadata.deadline);
  if (!due.isValid || !maxExtension.isValid || !deadline.isValid) {
    return false;
  }

  const latestDeadline = due.plus(maxExtension);
  return (
    latestDeadline.isValid && deadline >= due && deadline <= latestDeadline
  );
}

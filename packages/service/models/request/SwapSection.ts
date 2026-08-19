import { z } from "zod";
import { type Course, Courses } from "../course";
import { createRequestType } from "./BaseRequest";

export const SwapSectionMeta = z.object({
  fromSection: z
    .string()
    .meta({ description: "The section code to swap from." }),
  fromDate: z.iso
    .date()
    .meta({ description: "The date of the section to swap from." }),
  toSection: z
    .string()
    .meta({ description: "The desired section code to swap to." }),
  toDate: z.iso
    .date()
    .meta({ description: "The date of the section to swap to." }),
});
export type SwapSectionMeta = z.infer<typeof SwapSectionMeta>;

export const SwapSectionRequest = createRequestType(
  "Swap Section",
  SwapSectionMeta,
).meta({
  title: "Swap Section",
  description: "Request for swapping to another section for one class",
});
export type SwapSectionRequest = z.infer<typeof SwapSectionRequest>;

export function validateSwapSection(
  course: Course,
  metadata: SwapSectionMeta,
): boolean {
  return (
    metadata.fromSection !== metadata.toSection &&
    Courses.isSectionScheduledOnDate(
      course,
      metadata.fromSection,
      metadata.fromDate,
    ) &&
    Courses.isSectionScheduledOnDate(
      course,
      metadata.toSection,
      metadata.toDate,
    )
  );
}

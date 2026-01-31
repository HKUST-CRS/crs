import { z } from "zod";
import { createRequestType } from "./BaseRequest";

export const AbsentFromSectionMeta = z.object({
  fromSection: z
    .string()
    .meta({ description: "The section code to be absent from." }),
  fromDate: z.iso
    .date()
    .meta({ description: "The date of the section to be absent from." }),
});
export type AbsentFromSectionMeta = z.infer<typeof AbsentFromSectionMeta>;

export const AbsentFromSectionRequest = createRequestType(
  "Absent from Section",
  AbsentFromSectionMeta,
).meta({
  title: "Absent from Section",
  description: "Request for being absent from a section for one class",
});
export type AbsentFromSectionRequest = z.infer<typeof AbsentFromSectionRequest>;

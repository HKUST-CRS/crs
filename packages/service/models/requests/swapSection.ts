import { z } from "zod";
import { createRequestType } from "./base";

export const SwapSectionRequest = createRequestType(
  "Swap Section",
  z.object({
    fromSection: z.string().meta({ description: "Original Section Code" }),
    fromDate: z.iso.date().meta({ description: "Date of the Original Class" }),
    toSection: z.string().meta({ description: "Desired Section Code" }),
    toDate: z.iso.date().meta({ description: "Date of the Desired Class" }),
  })
).meta({
  description: "Request for swapping to another section for one class",
});

export type SwapSectionRequest = z.infer<typeof SwapSectionRequest>;

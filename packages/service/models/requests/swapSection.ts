import { z } from "zod";
import { createRequestConstructor } from "./base.js";
import { REQUEST_TYPES } from "./types.js";

/**
 * Swap Section Request
 * Allows students to request switching from one section to another
 */
export const SwapSectionRequest = createRequestConstructor(
  REQUEST_TYPES.SWAP_SECTION,
  z.object({
    fromSection: z.string().describe("Original Section Code"), // such as LA2, to be fetched from ITSO
    fromDate: z.iso.date().describe("Date of the Original Class"),
    toSection: z.string().describe("Desired Section Code"),
    toDate: z.iso.date().describe("Date of the Desired Class"),
  })
);

export type SwapSectionRequest = z.infer<typeof SwapSectionRequest>;

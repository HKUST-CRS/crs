import { z } from "zod";
import { createRequestConstructor } from "./base.js";
import { REQUEST_TYPES } from "./types.js";

/**
 * Deadline Extension Request
 * Allows students to request extension of assignment deadlines
 */
export const DeadlineExtensionRequest = createRequestConstructor(
  REQUEST_TYPES.DEADLINE_EXTENSION,
  z.object({
    assignmentName: z.string().describe("Name of the Assignment"),
    requestedDeadline: z.iso
      .datetime()
      .describe("The New Deadline Being Requested"),
  })
);

export type DeadlineExtensionRequest = z.infer<typeof DeadlineExtensionRequest>;

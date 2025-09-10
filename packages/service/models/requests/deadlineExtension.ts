import { z } from "zod";
import { createRequestType } from "./base";

export const DeadlineExtensionRequest = createRequestType(
  "Deadline Extension",
  z.object({
    assignmentName: z.string().meta({ description: "Name of the Assignment" }),
    requestedDeadline: z.iso
      .datetime()
      .meta({ description: "The New Deadline Being Requested" }),
  })
).meta({
  description: "Request for extension of assignment deadlines",
});

export type DeadlineExtensionRequest = z.infer<typeof DeadlineExtensionRequest>;

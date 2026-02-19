import z from "zod";
import { UserID } from "../user";

export const ResponseDecision = z.literal(["Approve", "Reject"]);
export type ResponseDecision = z.infer<typeof ResponseDecision>;

export const Response = z.object({
  from: UserID,
  timestamp: z.iso.datetime({ offset: true }),
  remarks: z.string(),
  decision: ResponseDecision,
});
export type Response = z.infer<typeof Response>;

export const ResponseInit = Response.omit({
  from: true,
  timestamp: true,
});
export type ResponseInit = z.infer<typeof ResponseInit>;

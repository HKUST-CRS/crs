import z from "zod";

export const RequestType = z.enum(["Swap Section", "Deadline Extension"]);
export type RequestType = z.infer<typeof RequestType>;

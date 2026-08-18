import z from "zod";

export const RequestType = z.enum([
  "Swap Section",
  "Absent from Section",
  "Deadline Extension",
  "Assignment Appeal",
]);
export type RequestType = z.infer<typeof RequestType>;

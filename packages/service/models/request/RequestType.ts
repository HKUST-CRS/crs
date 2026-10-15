import z from "zod";

export const RequestType = z.enum([
  "Swap Section",
  "Absent from Section",
  "Deadline Extension",
  "Exam Appeal",
  "Exam Special Arrangement",
]);
export type RequestType = z.infer<typeof RequestType>;

import { z } from "zod";

export const UserId = z.string(); // ITSO Username

export const CourseId = z.object({
  code: z.string(), // e.g. COMP1023
  semester: z.string(), // e.g. 2510
});

export const FileReference = z.file().max(5 * 1024 * 1024);

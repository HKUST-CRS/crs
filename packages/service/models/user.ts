import { z } from "zod";
import { UserId, CourseId, RequestId } from "./util";

const Role = z.literal(["student", "instructor", "ta"]);

export const User = z.object({
  _id: UserId,
  name: z.string().min(1, "Name cannot be empty"),
  email: z.email("Invalid email format"),
  courses: z
    .array(
      z.object({
        courseId: CourseId,
        role: Role,
      })
    )
    .default([]),
  requestIds: z.array(RequestId).default([]),
});

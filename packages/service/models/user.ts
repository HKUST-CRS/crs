import { z } from "zod";
import { Class } from "./course";

export const Role = z.enum(["student", "instructor", "ta"]);
export type Role = z.infer<typeof Role>;

export const User = z.object({
  email: z.email().meta({
    description: "The user's email address, used as the unique identifier.",
  }),
  name: z.string().meta({ description: "The full name of the user." }),
  enrollment: z.array(
    z.object({
      ...Class.shape,
      role: Role,
    }),
  ),
});
export type User = z.infer<typeof User>;

export const UserId = User.shape.email;
export type UserId = z.infer<typeof UserId>;

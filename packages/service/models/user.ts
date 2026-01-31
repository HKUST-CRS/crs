import { z } from "zod";
import { Class } from "./course";

export const Role = z.enum(["student", "instructor", "observer", "admin"]);
export type Role = z.infer<typeof Role>;
export const Roles = Role.options;

export const Enrollment = z.object({
  ...Class.shape,
  role: Role,
});
export type Enrollment = z.infer<typeof Enrollment>;

export const User = z.object({
  email: z.email().meta({
    description: "The user's email address, used as the unique identifier.",
  }),
  name: z.string().meta({ description: "The full name of the user." }),
  enrollment: z.array(Enrollment),
  sudoer: z.boolean().meta({
    description:
      "Indicates whether the user has sudo privileges. " +
      "If a user is a sudoer, they have the admin role in all courses, " +
      "their admin roles are fixed, and they can create new courses.",
  }),
});
export type User = z.infer<typeof User>;

export const UserId = User.shape.email;
export type UserId = z.infer<typeof UserId>;

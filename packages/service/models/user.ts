import { z } from "zod";

export const User = z.object({
  email: z.email().meta({ description: "User's email address, used as unique identifier" }),
  name: z.string().min(1),
});

export type User = z.infer<typeof User>;
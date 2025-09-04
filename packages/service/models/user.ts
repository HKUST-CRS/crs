import { z } from "zod";
import { UserId } from "./util";

export const User = z.object({
  id: UserId,
  name: z.string().min(1, "Name cannot be empty"),
  email: z.email("Invalid email format"),
});

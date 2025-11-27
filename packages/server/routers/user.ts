import { Class, Role, User } from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerUser = router({
  get: procedure
    .input(z.void())
    .output(User)
    .query(({ ctx }) => {
      return services.user.getUser(ctx.user.email);
    }),
  getAllFromClass: procedure
    .input(
      z.object({
        class: Class,
        role: Role,
      }),
    )
    .output(z.array(User))
    .query(({ input: { class: clazz, role }, ctx }) => {
      return services.user.getUsersFromClass(ctx.user.email, clazz, role);
    }),
});

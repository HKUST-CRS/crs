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
    .query(async({ input: { class: clazz, role }, ctx }) => {
      if (role === "student") {
        await services.user.assertClassRole(
          ctx.user.email,
          clazz,
          ["instructor", "ta"],
          `viewing students in class ${clazz.course.code} (${clazz.course.term})`,
        );
      }
      return services.user.getUsersFromClass(clazz, role);
    }),
});

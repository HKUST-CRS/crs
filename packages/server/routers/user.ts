// TODO: Authentication.

import { CourseId } from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerUser = router({
  current: procedure.input(z.email()).query(({ input }) => {
    return services.user.getUser(input);
  }),
  instructorsOf: procedure.input(CourseId).query(({ input }) => {
    return services.user.getInstructorsOf(input);
  }),
});

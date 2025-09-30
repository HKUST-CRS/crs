// TODO: Authentication.

import { CourseId } from "service/models";
import z from "zod";
import { services } from "../services";
import { publicProcedure, router } from "../trpc";

export const routerUser = router({
  current: publicProcedure.input(z.email()).query(({ input }) => {
    return services.user.getUser(input);
  }),
  instructorsOf: publicProcedure.input(CourseId).query(({ input }) => {
    return services.user.getInstructorsOf(input);
  }),
});

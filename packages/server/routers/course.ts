import { Course, CourseId } from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerCourse = router({
  get: procedure
    .input(CourseId)
    .output(Course)
    .query(({ input, ctx }) => {
      return services.course.getCourse(ctx.user.email, input);
    }),
  getEnrollment: procedure
    .input(z.void())
    .output(z.array(Course))
    .query(({ ctx }) => {
      return services.course.getCoursesFromEnrollment(ctx.user.email);
    }),
});

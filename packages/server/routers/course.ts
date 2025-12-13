import { Course, CourseId } from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerCourse = router({
  get: procedure
    .input(CourseId)
    .output(Course)
    .query(({ input, ctx }) => {
      return services.course.withAuth(ctx.user.email).getCourse(input);
    }),
  getEnrollment: procedure
    .input(z.void())
    .output(z.array(Course))
    .query(({ ctx }) => {
      return services.course
        .withAuth(ctx.user.email)
        .getCoursesFromEnrollment();
    }),
});

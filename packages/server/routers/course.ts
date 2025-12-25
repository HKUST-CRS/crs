import { Course, CourseId } from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerCourse = router({
  get: procedure
    .input(CourseId)
    .output(Course)
    .query(({ input, ctx }) => {
      return services.course.auth(ctx.user.email).getCourse(input);
    }),
  getEnrollment: procedure
    .input(z.void())
    .output(z.array(Course))
    .query(({ ctx }) => {
      return services.course.auth(ctx.user.email).getCoursesFromEnrollment();
    }),
  updateSections: procedure
    .input(
      z.object({
        courseId: CourseId,
        sections: Course.shape.sections,
      }),
    )
    .mutation(({ ctx, input }) => {
      return services.course
        .auth(ctx.user.email)
        .updateSections(input.courseId, input.sections);
    }),
  updateAssignments: procedure
    .input(
      z.object({
        courseId: CourseId,
        assignments: Course.shape.assignments,
      }),
    )
    .mutation(({ ctx, input }) => {
      return services.course
        .auth(ctx.user.email)
        .updateAssignments(input.courseId, input.assignments);
    }),
});

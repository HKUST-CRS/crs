import { Course, CourseId, Role } from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerCourse = router({
  create: procedure
    .input(Course)
    .output(CourseId)
    .mutation(({ input, ctx }) => {
      return services.course.auth(ctx.user.email).createCourse(input);
    }),
  get: procedure
    .input(CourseId)
    .output(Course)
    .query(({ input, ctx }) => {
      return services.course.auth(ctx.user.email).getCourse(input);
    }),
  getAllFromEnrollment: procedure
    .input(z.array(Role))
    .output(z.array(Course))
    .query(({ ctx, input }) => {
      return services.course
        .auth(ctx.user.email)
        .getCoursesFromEnrollment(input);
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

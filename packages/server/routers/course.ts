import { Course, CourseId } from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerCourse = router({
  get: procedure
    .input(CourseId)
    .output(Course)
    .query(({ input }) => {
      return services.course.getCourse(input);
    }),
  getEnrollment: procedure
    .input(z.void())
    .output(z.array(Course))
    .query(({ ctx }) => {
      return services.course.getCoursesFromEnrollment(ctx.user.email);
    }),
  updateSections: procedure
    .input(
      z.object({
        courseId: CourseId,
        sections: Course.shape.sections,
      }),
    )
    .mutation(({ input }) => {
      return services.course.updateSections(input.courseId, input.sections);
    }),
  updateAssignments: procedure
    .input(
      z.object({
        courseId: CourseId,
        assignments: Course.shape.assignments,
      }),
    )
    .mutation(({ input }) => {
      return services.course.updateAssignments(
        input.courseId,
        input.assignments,
      );
    }),
});

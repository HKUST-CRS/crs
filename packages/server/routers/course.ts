import { CourseId } from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerCourse = router({
  getAll: procedure.query(() => {
    return services.course.getCourses();
  }),
  get: procedure.input(CourseId).query(({ input }) => {
    return services.course.getCourse(input);
  }),
  getEnrollment: procedure.input(z.email()).query(({ input }) => {
    return services.course.getCoursesFromEnrollment(input);
  }),
});

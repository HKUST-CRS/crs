import { CourseId } from "service/models";
import z from "zod";
import { services } from "../services";
import { publicProcedure, router } from "../trpc";

export const routerCourse = router({
  getAll: publicProcedure.query(() => {
    return services.course.getCourses();
  }),
  get: publicProcedure.input(CourseId).query(({ input }) => {
    return services.course.getCourse(input);
  }),
  getEnrollment: publicProcedure.input(z.email()).query(({ input }) => {
    return services.course.getCoursesFromEnrollment(input);
  }),
});

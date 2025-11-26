import {
  Class,
  CourseId,
  Enrollment,
  Role,
  User,
  UserId,
} from "service/models";
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
    .query(({ input: { class: clazz, role } }) => {
      return services.user.getUsersFromClass(clazz, role);
    }),
  getAllFromCourse: procedure
    .input(CourseId)
    .output(z.array(User))
    .query(({ input }) => {
      return services.user.getUsersFromCourse(input);
    }),
  createEnrollment: procedure
    .input(
      z.object({
        uid: UserId,
        enrollment: Enrollment,
      }),
    )
    .mutation(({ input: { uid, enrollment } }) => {
      return services.user.createEnrollment(uid, enrollment);
    }),
  deleteEnrollment: procedure
    .input(
      z.object({
        uid: UserId,
        enrollment: Enrollment,
      }),
    )
    .mutation(({ input: { uid, enrollment } }) => {
      return services.user.deleteEnrollment(uid, enrollment);
    }),
});

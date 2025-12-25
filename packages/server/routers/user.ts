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
      return services.user.auth(ctx.user.email).getCurrentUser();
    }),
  getAllFromClass: procedure
    .input(
      z.object({
        class: Class,
        role: Role,
      }),
    )
    .output(z.array(User))
    .query(({ input: { class: clazz, role }, ctx }) => {
      return services.user.auth(ctx.user.email).getUsersFromClass(clazz, role);
    }),
  getAllFromCourse: procedure
    .input(CourseId)
    .output(z.array(User))
    .query(({ ctx, input }) => {
      return services.user.auth(ctx.user.email).getUsersFromCourse(input);
    }),
  createEnrollment: procedure
    .input(
      z.object({
        uid: UserId,
        enrollment: Enrollment,
      }),
    )
    .mutation(({ ctx, input: { uid, enrollment } }) => {
      return services.user
        .auth(ctx.user.email)
        .createEnrollmentForUser(uid, enrollment);
    }),
  deleteEnrollment: procedure
    .input(
      z.object({
        uid: UserId,
        enrollment: Enrollment,
      }),
    )
    .mutation(({ ctx, input: { uid, enrollment } }) => {
      return services.user
        .auth(ctx.user.email)
        .deleteEnrollmentForUser(uid, enrollment);
    }),
});

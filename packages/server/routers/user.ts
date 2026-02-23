import {
  Class,
  CourseID,
  Enrollment,
  Role,
  User,
  UserID,
} from "service/models";
import z from "zod";
import { services } from "../services";
import { procedure, router } from "../trpc";

export const routerUser = router({
  get: procedure
    .input(UserID)
    .output(User)
    .query(({ ctx, input }) => {
      return services.user.auth(ctx.user.email).getUser(input);
    }),
  getCurrent: procedure
    .input(z.void())
    .output(User)
    .query(({ ctx }) => {
      return services.user.auth(ctx.user.email).getCurrentUser();
    }),
  getAllFromCourse: procedure
    .input(CourseID)
    .output(z.array(User))
    .query(({ ctx, input }) => {
      return services.user.auth(ctx.user.email).getUsersInCourse(input);
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
      return services.user.auth(ctx.user.email).getUsersInClass(clazz, role);
    }),
  suggestName: procedure
    .input(
      z.object({
        uid: UserID,
        name: z.string(),
      }),
    )
    .output(z.void())
    .mutation(({ ctx, input }) => {
      return services.user
        .auth(ctx.user.email)
        .suggestUserName(input.uid, input.name);
    }),
  getEnrollments: procedure
    .input(z.array(Role))
    .output(z.array(Enrollment))
    .query(({ ctx, input }) => {
      return services.user.auth(ctx.user.email).getEnrollments(input);
    }),
  createEnrollment: procedure
    .input(
      z.object({
        uid: UserID,
        enrollment: Enrollment,
      }),
    )
    .mutation(({ ctx, input: { uid, enrollment } }) => {
      return services.user
        .auth(ctx.user.email)
        .createEnrollment(uid, enrollment);
    }),
  deleteEnrollment: procedure
    .input(
      z.object({
        uid: UserID,
        enrollment: Enrollment,
      }),
    )
    .mutation(({ ctx, input: { uid, enrollment } }) => {
      return services.user
        .auth(ctx.user.email)
        .deleteEnrollment(uid, enrollment);
    }),
});

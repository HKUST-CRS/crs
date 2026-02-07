import type { Class, Course, CourseId, Role, User } from "../models";
import {
  ClassPermissionError,
  CoursePermissionError,
  PermissionError,
  SudoerPermissionError,
} from "./error";

export function assertRole(user: User, roles: Role[], op?: string) {
  const hasRole = user.enrollment.some((e) => roles.includes(e.role));
  if (!hasRole) {
    throw new PermissionError(user.email, roles, op || "accessing something");
  }
}

/**
 * Asserts that the user has one of the specified roles in the given course.
 *
 * @param user The user whose role is being checked.
 * @param course The course in which the role is being checked.
 * @param roles The roles to check for.
 * @param op The operation being performed (used for error messages).
 *
 * @throws CoursePermissionError if the user does not have the required role in the course.
 */
export function assertCourseRole(
  user: User,
  course: Course | CourseId,
  roles: Role[],
  op?: string,
) {
  const hasRole = user.enrollment.some(
    (e) =>
      e.course.code === course.code &&
      e.course.term === course.term &&
      roles.includes(e.role),
  );
  if (!hasRole) {
    throw new CoursePermissionError(
      user.email,
      roles,
      course,
      op || "accessing the course",
    );
  }
}

/**
 * Asserts that the user has one of the specified roles in the given class.
 *
 * Enrollments with section "*" match any section in the course.
 *
 * @param user The user whose role is being checked.
 * @param clazz The class in which the role is being checked.
 * @param roles The roles to check for.
 * @param op The operation being performed (used for error messages).
 *
 * @throws ClassPermissionError if the user does not have the required role in the class.
 */
export function assertClassRole(
  user: User,
  clazz: Class,
  roles: Role[],
  op?: string,
) {
  const hasRole = user.enrollment.some(
    (e) =>
      e.course.code === clazz.course.code &&
      e.course.term === clazz.course.term &&
      (e.section === clazz.section || e.section === "*") &&
      roles.includes(e.role),
  );
  if (!hasRole) {
    throw new ClassPermissionError(
      user.email,
      roles,
      clazz,
      op || "accessing the class",
    );
  }
}

/**
 * Asserts that the user is a sudoer.
 *
 * @param user The user to check.
 * @param op The operation being performed (used for error messages).
 *
 * @throws SudoerPermissionError if the user is not a sudoer.
 */
export function assertSudoer(user: User, op: string) {
  if (!user.sudoer) {
    throw new SudoerPermissionError(user.email, op);
  }
}

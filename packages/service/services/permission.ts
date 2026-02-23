import type { Class, CourseID, Role, User } from "../models";
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
 * Asserts that the user has one of the specified roles in one of the given
 * courses.
 *
 * @param user The user whose role is being checked.
 * @param courses The courses in which the role is being checked.
 * @param roles The roles to check for.
 * @param op The operation being performed (used for error messages).
 *
 * @throws CoursePermissionError if the user does not have the required role in
 * one of the courses.
 */
export function assertCourseRole(
  user: User,
  courses: CourseID | CourseID[],
  roles: Role[],
  op?: string,
) {
  if (!Array.isArray(courses))
    return assertCourseRole(user, [courses], roles, op);
  const hasRole = user.enrollment.some(
    (e) =>
      courses.some(
        (c) => c.code === e.course.code && c.term === e.course.term,
      ) && roles.includes(e.role),
  );
  if (!hasRole) {
    throw new CoursePermissionError(
      user.email,
      roles,
      courses,
      op || "accessing the course",
    );
  }
}

/**
 * Asserts that the user has one of the specified roles in one of the given
 * classes.
 *
 * Enrollments with section "*" match any section in the course.
 *
 * @param user The user whose role is being checked.
 * @param classes The class in which the role is being checked.
 * @param roles The roles to check for.
 * @param op The operation being performed (used for error messages).
 *
 * @throws ClassPermissionError if the user does not have the required role in
 * one of the classes.
 */
export function assertClassRole(
  user: User,
  classes: Class | Class[],
  roles: Role[],
  op?: string,
) {
  if (!Array.isArray(classes))
    return assertClassRole(user, [classes], roles, op);
  const hasRole = user.enrollment.some(
    (e) =>
      classes.some(
        (c) =>
          e.course.code === c.course.code &&
          e.course.term === c.course.term &&
          (e.section === c.section || e.section === "*"),
      ) && roles.includes(e.role),
  );
  if (!hasRole) {
    throw new ClassPermissionError(
      user.email,
      roles,
      classes,
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

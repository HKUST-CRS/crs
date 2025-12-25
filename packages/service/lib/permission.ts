import {
  type Class,
  Classes,
  type Course,
  type CourseId,
  type Role,
  type User,
} from "../models";
import { ClassPermissionError, CoursePermissionError } from "./error";

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

export function assertClassRole(
  user: User,
  clazz: Class,
  roles: Role[],
  op?: string,
) {
  const hasRole = user.enrollment.some(
    (e) =>
      Classes.id2str(e) === Classes.id2str(clazz) && roles.includes(e.role),
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

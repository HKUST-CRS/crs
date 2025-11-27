import {
  type Class,
  Classes,
  type Course,
  type CourseId,
  type Role,
  type User,
} from "../models";
import { ClassPermissionError, CoursePermissionError } from "./error";

export function assertInCourse(user: User, course: CourseId, op?: string) {
  const isInCourse = user.enrollment.some(
    (e) => e.course.code === course.code && e.course.term === course.term,
  );
  if (!isInCourse) {
    throw new CoursePermissionError(
      user.email,
      [],
      course,
      op || "accessing course",
    );
  }
}

export function assertCourseInstructor(
  user: User,
  course: Course | CourseId,
  op?: string,
) {
  const isInstructor = user.enrollment.some(
    (e) =>
      e.course.code === course.code &&
      e.course.term === course.term &&
      e.role === "instructor",
  );
  if (!isInstructor) {
    throw new CoursePermissionError(
      user.email,
      ["instructor"],
      course,
      op || "accessing course as instructor",
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
      op || "accessing class",
    );
  }
}

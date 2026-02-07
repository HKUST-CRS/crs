import {
  type Class,
  Classes,
  type CourseId,
  Courses,
  type RequestId,
  type Role,
  type UserId,
} from "../models";

export class PermissionError extends Error {
  constructor(uid: UserId, roles: Role[], operation: string) {
    const roleStr =
      roles.length > 0 ? `the role ${roles.join("/")}` : "any role";
    super(`User ${uid} does not have ${roleStr} for ${operation}.`);
    this.name = "PermissionError";
  }
}

export class CoursePermissionError extends Error {
  constructor(
    userId: UserId,
    roles: Role[],
    courseId: CourseId,
    operation: string,
  ) {
    const roleStr =
      roles.length > 0 ? `the role ${roles.join("/")}` : "any role";
    super(
      `User ${userId} does not have ${roleStr} in course ${Courses.formatID(courseId)} for ${operation}.`,
    );
    this.name = "CoursePermissionError";
  }
}

export class ClassPermissionError extends Error {
  constructor(userId: UserId, roles: Role[], clazz: Class, operation: string) {
    const roleStr =
      roles.length > 0 ? `the role ${roles.join("/")}` : "any role";
    super(
      `User ${userId} does not have ${roleStr} in class ${Classes.format(clazz)} for ${operation}.`,
    );
    this.name = "ClassPermissionError";
  }
}

export class SudoerPermissionError extends Error {
  constructor(userId: UserId, operation: string) {
    super(`User ${userId} is not a sudoer and cannot perform ${operation}.`);
    this.name = "SudoerPermissionError";
  }
}

export class ResponseNotFoundError extends Error {
  constructor(requestId: RequestId) {
    super(`Request ${requestId} does not have a response yet`);
    this.name = "ResponseNotFoundError";
  }
}

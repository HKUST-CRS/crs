import {
  type Class,
  Classes,
  type CourseId,
  Courses,
  type RequestId,
  type Role,
  type UserId,
} from "../models";

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
      `User ${userId} does not have ${roleStr} in course ${Courses.id2str(courseId)} for ${operation}.`,
    );
    this.name = "CoursePermissionError";
  }
}

export class ClassPermissionError extends Error {
  constructor(userId: UserId, roles: Role[], clazz: Class, operation: string) {
    const roleStr =
      roles.length > 0 ? `the role ${roles.join("/")}` : "any role";
    super(
      `User ${userId} does not have ${roleStr} in class ${Classes.id2str(clazz)} for ${operation}.`,
    );
    this.name = "ClassPermissionError";
  }
}

export class ResponseNotFoundError extends Error {
  constructor(requestId: RequestId) {
    super(`Request ${requestId} does not have a response yet`);
    this.name = "ResponseNotFoundError";
  }
}

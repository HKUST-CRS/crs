import { type Class, Classes, Courses, type RequestId } from "service/models";
import type { CourseId, Role, UserId } from "../models";

export class UserNotFoundError extends Error {
  constructor(userId: UserId) {
    super(`User ${userId} not found`);
    this.name = "UserNotFoundError";
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

export class CourseNotFoundError extends Error {
  constructor(courseId: CourseId) {
    super(`Course ${courseId.code} (${courseId.term}) not found`);
    this.name = "CourseNotFoundError";
  }
}

export class SectionNotFoundError extends Error {
  constructor(courseId: CourseId, section: string) {
    super(
      `Section ${section} not found in course ${courseId.code} (${courseId.term})`,
    );
    this.name = "SectionNotFoundError";
  }
}

export class RequestNotFoundError extends Error {
  constructor(requestId: RequestId) {
    super(`Request ${requestId} not found`);
    this.name = "RequestNotFoundError";
  }
}

export class ResponseAlreadyExistsError extends Error {
  constructor(requestId: RequestId) {
    super(`Request ${requestId} already has a response`);
    this.name = "ResponseAlreadyExistsError";
  }
}

export class ResponseNotFoundError extends Error {
  constructor(requestId: RequestId) {
    super(`Request ${requestId} does not have a response yet`);
    this.name = "ResponseNotFoundError";
  }
}

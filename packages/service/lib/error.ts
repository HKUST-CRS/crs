import { type Class, Classes, type RequestId, Users } from "service/models";
import type { CourseId, Role, User, UserId } from "../models";

export class UserNotFoundError extends Error {
  constructor(userId: UserId) {
    super(`User ${userId} not found`);
    this.name = "UserNotFoundError";
  }
}

export class UserClassEnrollmentError extends Error {
  constructor(userId: UserId, clazz: Class) {
    super(
      `User ${userId} is not enrolled in the class ${Classes.id2str(clazz)}`,
    );
    this.name = "UserClassEnrollmentError";
  }
}

export class UserPermissionError extends Error {
  constructor(userId: UserId, role: string, clazz: Class, operation: string) {
    super(`User ${userId} does not have the role ${role} in class ${Classes.id2str(clazz)} for ${operation}.`);
    this.name = "UserPermissionError";
  }

  static assertRole(user: User, clazz: Class, role: Role, operation: string) {
    if (!Users.hasRole(user, clazz, role)) {
      throw new UserPermissionError(user.email, role, clazz, operation);
    }
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
import { type Class, Classes, type RequestId } from "service/models";
import type { CourseId, UserId } from "../models";

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

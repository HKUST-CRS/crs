import type { RequestId } from "service/models";
import type { CourseId, UserId } from "../models";

export class UserNotFoundError extends Error {
  constructor(userId: UserId) {
    super(`User ${userId} not found`);
    this.name = "UserNotFoundError";
  }
}

export class CourseNotFoundError extends Error {
  constructor(courseId: CourseId) {
    super(`Course ${courseId.code} (${courseId.term}) not found`);
    this.name = "CourseNotFoundError";
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

export function assertAck(result: { acknowledged: boolean }, op: string): void {
  if (!result.acknowledged) {
    throw new Error(`Operation ${op} not acknowledged`);
  }
}

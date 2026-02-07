import type { CourseID, RequestID, UserID } from "../models";

export class UserNotFoundError extends Error {
  constructor(userID: UserID) {
    super(`User ${userID} not found`);
    this.name = "UserNotFoundError";
  }
}

export class CourseNotFoundError extends Error {
  constructor(courseID: CourseID) {
    super(`Course ${courseID.code} (${courseID.term}) not found`);
    this.name = "CourseNotFoundError";
  }
}

export class RequestNotFoundError extends Error {
  constructor(requestID: RequestID) {
    super(`Request ${requestID} not found`);
    this.name = "RequestNotFoundError";
  }
}

export class ResponseAlreadyExistsError extends Error {
  constructor(requestID: RequestID) {
    super(`Request ${requestID} already has a response`);
    this.name = "ResponseAlreadyExistsError";
  }
}

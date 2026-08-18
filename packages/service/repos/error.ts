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

export class StatusConflictError extends Error {
  constructor(
    requestID: RequestID,
    expected: string,
    actual: string,
    op: string,
  ) {
    super(
      `Cannot ${op} on request ${requestID}: expected status "${expected}", but it is "${actual}".`,
    );
    this.name = "StatusConflictError";
  }
}

export class ProofNotFoundError extends Error {
  constructor(attachmentId: string) {
    super(`Proof file ${attachmentId} not found`);
    this.name = "ProofNotFoundError";
  }
}

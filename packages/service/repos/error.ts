import type { AppealID, CourseID, RequestID, UserID } from "../models";

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

export class AppealNotFoundError extends Error {
  constructor(appealID: AppealID);
  constructor(course: CourseID, assignment: string, student: UserID);
  constructor(
    appealIDOrCourse: AppealID | CourseID,
    assignment?: string,
    student?: UserID,
  ) {
    if (typeof appealIDOrCourse === "string") {
      super(`Appeal ${appealIDOrCourse} not found`);
    } else {
      super(
        `Appeal for course ${appealIDOrCourse.code} (${appealIDOrCourse.term}), ` +
          `assignment ${assignment}, student ${student} not found`,
      );
    }
    this.name = "AppealNotFoundError";
  }
}

export class AppealAlreadyExistsError extends Error {
  constructor(course: CourseID, assignment: string, student: UserID) {
    super(
      `Appeal for course ${course.code} (${course.term}), ` +
        `assignment ${assignment}, student ${student} already exists`,
    );
    this.name = "AppealAlreadyExistsError";
  }
}

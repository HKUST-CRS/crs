import {
  type AppealID,
  type Class,
  Classes,
  type CourseID,
  Courses,
  type RequestID,
  type Role,
  type UserID,
} from "../models";

export class PermissionError extends Error {
  constructor(uid: UserID, roles: Role[], operation: string) {
    const roleStr =
      roles.length > 0 ? `the role ${roles.join("/")}` : "any role";
    super(`User ${uid} does not have ${roleStr} for ${operation}.`);
    this.name = "PermissionError";
  }
}

export class CoursePermissionError extends Error {
  constructor(
    userID: UserID,
    roles: Role[],
    courses: CourseID[],
    operation: string,
  ) {
    const roleStr =
      roles.length > 0 ? `role(s) ${roles.join("/")}` : "any role";
    const coursesStr =
      courses.length > 0
        ? `courses ${courses.map(Courses.formatID).join(", ")}`
        : "no courses (internal error!)";
    super(
      `User ${userID} does not have ${roleStr} in ${coursesStr} for ${operation}.`,
    );
    this.name = "CoursePermissionError";
  }
}

export class ClassPermissionError extends Error {
  constructor(
    userID: UserID,
    roles: Role[],
    classes: Class[],
    operation: string,
  ) {
    const roleStr =
      roles.length > 0 ? `role(s) ${roles.join("/")}` : "any role";
    const classesStr =
      classes.length > 0
        ? `classes ${classes.map(Classes.format).join(", ")}`
        : "no classes (internal error!)";
    super(
      `User ${userID} does not have ${roleStr} in ${classesStr} for ${operation}.`,
    );
    this.name = "ClassPermissionError";
  }
}

export class SudoerPermissionError extends Error {
  constructor(userID: UserID, operation: string) {
    super(`User ${userID} is not a sudoer and cannot perform ${operation}.`);
    this.name = "SudoerPermissionError";
  }
}

export class ResponseNotFoundError extends Error {
  constructor(requestID: RequestID) {
    super(`Request ${requestID} does not have a response yet`);
    this.name = "ResponseNotFoundError";
  }
}

export class AssignmentNotFoundError extends Error {
  constructor(course: CourseID, assignment: string) {
    super(
      `Assignment ${assignment} not found in course ${course.code} (${course.term})`,
    );
    this.name = "AssignmentNotFoundError";
  }
}

export class AssignmentNotGradedError extends Error {
  constructor(course: CourseID, assignment: string) {
    super(
      `Assignment ${assignment} in course ${course.code} (${course.term}) is not graded yet`,
    );
    this.name = "AssignmentNotGradedError";
  }
}

export class AppealPermissionError extends Error {
  constructor(userID: UserID, appealID: AppealID) {
    super(`User ${userID} is not a participant of appeal ${appealID}`);
    this.name = "AppealPermissionError";
  }
}

export class AppealClosedError extends Error {
  constructor(appealID: AppealID) {
    super(`Appeal ${appealID} is closed`);
    this.name = "AppealClosedError";
  }
}

export class AppealParticipantExistsError extends Error {
  constructor(appealID: AppealID, userID: UserID) {
    super(`User ${userID} is already a participant of appeal ${appealID}`);
    this.name = "AppealParticipantExistsError";
  }
}

export class AppealClosePendingError extends Error {
  constructor(appealID: AppealID) {
    super(`Appeal ${appealID} already has a pending close request`);
    this.name = "AppealClosePendingError";
  }
}

export class AppealCloseRequestNotFoundError extends Error {
  constructor(appealID: AppealID) {
    super(`Appeal ${appealID} has no pending close request`);
    this.name = "AppealCloseRequestNotFoundError";
  }
}

export class AppealCloseRequiresStudentError extends Error {
  constructor(userID: UserID, appealID: AppealID) {
    super(
      `User ${userID} is not the student of appeal ${appealID} and cannot ` +
        "agree to or decline its close request",
    );
    this.name = "AppealCloseRequiresStudentError";
  }
}
